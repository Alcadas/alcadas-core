import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ApprovalTier,
  CostCenter,
  EloAuditoriaDto,
  SolicitacaoResponseDto,
} from '@alcadas-core/models';
import { Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { mensagemDeErroDaApi } from '../../../core/http/api-error';
import { CATEGORY_OPTIONS, ContextoDoMapeamento, etapasDaTrilha, paraRequestItem } from '../requests.mapper';
import {
  ApprovalStep,
  CostCenterOption,
  CreateRequestDto,
  DecisionAction,
  LoadState,
  RequestItem,
  RequestStats,
} from '../requests.models';

/** Quantidade lida por vez (máximo do contrato OpenAPI v0.2 — FinOps). */
export const TAMANHO_DA_PAGINA_DA_API = 50;

/**
 * Estado da Central de Solicitações ligado à API (Jornadas 1 a 3 e 5):
 * lista e submissão (`/solicitacoes`), centros de custo e tetos (`/centros-custo`, `/alcadas/tetos`),
 * decisões do aprovador e trilha.
 */
@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiBaseUrl = inject(APP_CONFIG).apiBaseUrl;

  readonly categories = CATEGORY_OPTIONS;

  private readonly _requests = signal<RequestItem[]>([]);
  private readonly _costCenters = signal<CostCenterOption[]>([]);
  private readonly _tiers = signal<ApprovalTier[]>([]);
  private readonly _loadState = signal<LoadState>('carregando');
  private readonly _loadError = signal<string | null>(null);

  readonly requests = this._requests.asReadonly();
  readonly costCenters = this._costCenters.asReadonly();
  readonly tiers = this._tiers.asReadonly();
  readonly loadState = this._loadState.asReadonly();
  readonly loadError = this._loadError.asReadonly();

  readonly stats = computed<RequestStats>(() => calcularIndicadores(this._requests()));

  /**
   * Carrega solicitações, centros de custo e tetos. Centros e tetos são complementares:
   * se falharem, a lista aparece mesmo assim (com nomes/alçadas genéricos).
   */
  load(): void {
    this._loadState.set('carregando');
    this._loadError.set(null);

    forkJoin({
      solicitacoes: this.http.get<SolicitacaoResponseDto[]>(`${this.apiBaseUrl}/solicitacoes`, {
        params: { page: 1, limit: TAMANHO_DA_PAGINA_DA_API },
      }),
      centros: this.http.get<CostCenter[]>(`${this.apiBaseUrl}/centros-custo`).pipe(catchError(() => of([]))),
      tetos: this.http.get<ApprovalTier[]>(`${this.apiBaseUrl}/alcadas/tetos`).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ solicitacoes, centros, tetos }) => {
        this._costCenters.set(centros.map((c) => ({ id: c.id, code: c.code, nome: c.name })));
        this._tiers.set(tetos);
        this._requests.set(solicitacoes.map((dto) => paraRequestItem(dto, this.contexto())));
        this._loadState.set('pronto');
      },
      error: (erro: unknown) => {
        this._loadError.set(mensagemDeErroDaApi(erro));
        this._loadState.set('erro');
      },
    });
  }

  /** T01 — `POST /solicitacoes`. A nova solicitação entra no topo da lista. */
  create(dto: CreateRequestDto): Observable<RequestItem> {
    return this.http.post<SolicitacaoResponseDto>(`${this.apiBaseUrl}/solicitacoes`, dto).pipe(
      map((resposta) => paraRequestItem(resposta, this.contexto())),
      tap((criada) => this._requests.update((lista) => [criada, ...lista])),
    );
  }

  /**
   * T02/T03/T04 — aprovar, rejeitar ou pedir ajuste, sempre com a `versao` lida (CA-05.1).
   * `motivo` é obrigatório (≥ 10 caracteres) para rejeitar e pedir ajuste (CA-03.2).
   */
  decide(request: RequestItem, acao: DecisionAction, motivo?: string): Observable<RequestItem> {
    const corpo = acao === 'aprovar' ? { versao: request.versao } : { versao: request.versao, motivo };
    return this.http
      .post<SolicitacaoResponseDto>(`${this.apiBaseUrl}/solicitacoes/${encodeURIComponent(request.id)}/${acao}`, corpo)
      .pipe(
        map((resposta) => paraRequestItem(resposta, this.contexto())),
        tap((atualizada) =>
          this._requests.update((lista) => lista.map((item) => (item.id === atualizada.id ? atualizada : item))),
        ),
      );
  }

  /** US-07 — linha do tempo da trilha SHA-256 da solicitação. */
  loadTrail(id: string): Observable<ApprovalStep[]> {
    return this.http
      .get<EloAuditoriaDto[]>(`${this.apiBaseUrl}/solicitacoes/${encodeURIComponent(id)}/trilha`)
      .pipe(map(etapasDaTrilha));
  }

  private contexto(): ContextoDoMapeamento {
    return {
      centrosDeCusto: this._costCenters(),
      tetos: this._tiers(),
      usuarioAtualId: this.authService.currentUser()?.id,
    };
  }
}

function calcularIndicadores(lista: readonly RequestItem[]): RequestStats {
  const total = lista.length;
  const contar = (status: RequestItem['status']) => lista.filter((r) => r.status === status);
  const pendentes = contar('PENDENTE');
  const aprovadas = contar('APROVADA').length;
  const rejeitadas = contar('REJEITADA').length;
  const percentual = (parte: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

  return {
    total,
    totalPercentCompleted: percentual(aprovadas + rejeitadas),
    pendentes: pendentes.length,
    pendentesValorTotal: pendentes.reduce((soma, r) => soma + r.valor, 0),
    aprovadas,
    taxaAprovacao: percentual(aprovadas),
    ajustes: contar('EM_AJUSTE').length,
    rejeitadas,
  };
  getRequestById(id: string): RequestItem | undefined {
    return this._requests().find((r) => r.id === id);
  }

  cancelRequest(id: string): boolean {
    let updated = false;
    this._requests.update((list) =>
      list.map((req) => {
        if (req.id === id && (req.status === 'PENDENTE' || req.status === 'AJUSTE_SOLICITADO')) {
          updated = true;
          return {
            ...req,
            status: 'CANCELADA',
            statusLabel: 'Cancelada',
            statusIcon: 'do_not_disturb_on',
            dataAtualizacao: new Date().toISOString(),
          };
        }
        return req;
      })
    );
    return updated;
  }

  approveRequest(
    id: string,
    signatureImg?: string,
    comentario?: string,
    signatario = 'Diretoria Executiva / Aprovador'
  ): boolean {
    let updated = false;
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');
    const randomHash =
      Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('') +
      '...' +
      Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    this._requests.update((list) =>
      list.map((req) => {
        if (req.id !== id) return req;
        updated = true;

        const currentStepIndex = req.fluxoDestinado.etapas.findIndex(
          (e) => e.status === 'PENDENTE' || e.status === 'EM_ANALISE' || e.status === 'AJUSTE'
        );

        const updatedEtapas = req.fluxoDestinado.etapas.map((step, idx) => {
          if (
            idx === currentStepIndex ||
            (currentStepIndex === -1 && idx === req.fluxoDestinado.etapas.length - 1)
          ) {
            return {
              ...step,
              status: 'CONCLUIDA' as const,
              dataHora: nowFormatted,
              responsavelNome: signatario,
              comentario: comentario || 'Aprovado e assinado digitalmente com conformidade orçamentária.',
              assinatura: {
                signatario,
                cargo: 'Aprovador de Alçada Titular',
                dataHora: nowFormatted,
                hashSha256: randomHash,
                assinaturaImg: signatureImg,
              },
            };
          }
          return step;
        });

        const isLastStep =
          currentStepIndex === -1 || currentStepIndex >= req.fluxoDestinado.etapas.length - 1;

        const nextStep = isLastStep ? null : req.fluxoDestinado.etapas[currentStepIndex + 1];

        return {
          ...req,
          status: isLastStep ? ('APROVADA' as const) : ('PENDENTE' as const),
          statusLabel: isLastStep ? 'Aprovada' : 'Em Análise',
          statusIcon: isLastStep ? 'verified' : 'hourglass_top',
          dataAtualizacao: nowIso,
          fluxoDestinado: {
            ...req.fluxoDestinado,
            etapaAtualNumero: isLastStep
              ? req.fluxoDestinado.totalEtapas
              : currentStepIndex + 2,
            etapaAtualNome: isLastStep
              ? 'Concluída (Totalmente Aprovada)'
              : nextStep?.nome || 'Próxima Alçada',
            etapas: updatedEtapas,
          },
        };
      })
    );
    return updated;
  }

  validateRequest(
    id: string,
    parecer = 'Validado tecnicamente conforme normas corporativas e orçamentos anexados.',
    autor = 'Auditoria & Compliance'
  ): boolean {
    let updated = false;
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');

    this._requests.update((list) =>
      list.map((req) => {
        if (req.id !== id) return req;
        updated = true;

        const currentStepIndex = req.fluxoDestinado.etapas.findIndex(
          (e) => e.status === 'PENDENTE' || e.status === 'EM_ANALISE' || e.status === 'AJUSTE'
        );

        const updatedEtapas = req.fluxoDestinado.etapas.map((step, idx) => {
          if (idx === currentStepIndex) {
            return {
              ...step,
              comentario: `Validação técnica realizada por ${autor}: ${parecer} (${nowFormatted})`,
            };
          }
          return step;
        });

        return {
          ...req,
          dataAtualizacao: nowIso,
          fluxoDestinado: {
            ...req.fluxoDestinado,
            etapas: updatedEtapas,
          },
        };
      })
    );
    return updated;
  }

  requestAdjustment(id: string, motivo: string, autor = 'Comitê de Alçadas'): boolean {
    let updated = false;
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');

    this._requests.update((list) =>
      list.map((req) => {
        if (req.id !== id) return req;
        updated = true;

        const updatedEtapas = req.fluxoDestinado.etapas.map((step) => {
          if (step.status === 'PENDENTE' || step.status === 'EM_ANALISE') {
            return {
              ...step,
              status: 'AJUSTE' as const,
              dataHora: nowFormatted,
              comentario: `Ajuste solicitado por ${autor}: ${motivo}`,
            };
          }
          return step;
        });

        return {
          ...req,
          status: 'AJUSTE_SOLICITADO' as const,
          statusLabel: 'Requer Ajuste',
          statusIcon: 'edit_note',
          dataAtualizacao: nowIso,
          fluxoDestinado: {
            ...req.fluxoDestinado,
            etapaAtualNome: 'Aguardando Revisão do Solicitante',
            etapas: updatedEtapas,
          },
        };
      })
    );
    return updated;
  }

  rejectRequest(id: string, motivo: string, autor = 'Diretoria de Alçadas'): boolean {
    let updated = false;
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');

    this._requests.update((list) =>
      list.map((req) => {
        if (req.id !== id) return req;
        updated = true;

        const updatedEtapas = req.fluxoDestinado.etapas.map((step) => {
          if (step.status === 'PENDENTE' || step.status === 'EM_ANALISE') {
            return {
              ...step,
              status: 'REJEITADA' as const,
              dataHora: nowFormatted,
              comentario: `Rejeitado por ${autor}: ${motivo}`,
            };
          }
          return step;
        });

        return {
          ...req,
          status: 'REJEITADA' as const,
          statusLabel: 'Recusada',
          statusIcon: 'cancel',
          dataAtualizacao: nowIso,
          fluxoDestinado: {
            ...req.fluxoDestinado,
            etapaAtualNome: 'Fluxo Encerrado (Reprovado)',
            etapas: updatedEtapas,
          },
        };
      })
    );
    return updated;
  }

  approveBatch(ids: string[], signatureImg?: string): number {
    let count = 0;
    ids.forEach((id) => {
      if (this.approveRequest(id, signatureImg, 'Aprovação em lote autorizada pela gestão de alçadas.')) {
        count++;
      }
    });
    return count;
  }
}
