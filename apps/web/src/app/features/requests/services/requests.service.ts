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
import { SettingsService } from '../../settings/services/settings.service';
import {
  CATEGORY_OPTIONS,
  ContextoDoMapeamento,
  etapasDaTrilha,
  fluxoDaAlcada,
  inferirPrioridade,
  paraRequestItem,
} from '../requests.mapper';
import {
  ApprovalStep,
  CostCenterOption,
  CreateRequestDto,
  CreateRequestFormPayload,
  DecisionAction,
  LoadState,
  RequestItem,
  RequestStats,
  WorkflowDestination,
} from '../requests.models';

/** Quantidade lida por vez (máximo do contrato OpenAPI v0.2 — FinOps). */
export const TAMANHO_DA_PAGINA_DA_API = 50;

const INITIAL_COST_CENTERS: CostCenterOption[] = [
  { id: 'cc-ti', code: 'CC-TI-01', nome: 'Tecnologia & Infraestrutura', departamento: 'TI & Engenharia' },
  { id: 'cc-clinica-centro', code: 'CC-CENTRO', nome: 'Clínica Centro', departamento: 'Operações' },
  { id: 'cc-fin', code: 'CC-FIN-02', nome: 'Controladoria & Finanças', departamento: 'Financeiro' },
];

const INITIAL_SEED_REQUESTS: RequestItem[] = [
  {
    id: 'sol-seed-001',
    codigo: '#SOL-001',
    titulo: 'Renovação Anual de Licenças Figma Enterprise',
    descricao: 'Renovação do plano corporativo Figma para a equipe de Produto e Design.',
    categoria: 'EQUIPAMENTOS',
    categoriaLabel: 'Equipamentos',
    categoriaIcon: 'devices',
    categoriaColor: '#644ef3',
    centroCustoId: 'cc-ti',
    centroCustoNome: 'Tecnologia & Infraestrutura',
    departamento: 'TI & Engenharia',
    valor: 18500,
    prioridade: 'ALTA',
    status: 'PENDENTE',
    statusLabel: 'Em análise',
    statusIcon: 'hourglass_top',
    versao: 1,
    dataCriacao: '2026-10-28T10:15:00Z',
    dataAtualizacao: '2026-10-28T10:15:00Z',
    solicitante: {
      id: 'usr-01',
      nome: 'Lucas Mendes',
      cargo: 'Tech Lead',
    },
    anexos: [
      {
        id: 'att-01',
        nome: 'Proposta_Comercial_Figma_2026.pdf',
        tamanho: '1.4 MB',
        tipo: 'application/pdf',
        icone: 'picture_as_pdf',
      },
    ],
    fluxoDestinado: {
      nome: 'Alçada N2 — Gerência de TI',
      totalEtapas: 2,
      etapaAtualNumero: 2,
      etapaAtualNome: 'Aguardando aprovador',
      etapas: [
        { numero: 1, nome: 'Submissão', papel: 'Solicitante', status: 'CONCLUIDA', dataHora: '28/10/2026 10:15' },
        { numero: 2, nome: 'Decisão N2', papel: 'Gerente de TI', status: 'EM_ANALISE' },
      ],
    },
  },
  {
    id: 'sol-seed-002',
    codigo: '#SOL-002',
    titulo: 'Contratação de Consultoria de Pentest e Auditoria Cloud',
    descricao: 'Auditoria anual de segurança ofensiva nos clusters de produção.',
    categoria: 'SERVICOS_TERCEIROS',
    categoriaLabel: 'Serviços de Terceiros',
    categoriaIcon: 'handshake',
    categoriaColor: '#0284c7',
    centroCustoId: 'cc-ti',
    centroCustoNome: 'Tecnologia & Infraestrutura',
    departamento: 'TI & Engenharia',
    valor: 42000,
    prioridade: 'CRITICA',
    status: 'PENDENTE',
    statusLabel: 'Em análise',
    statusIcon: 'hourglass_top',
    versao: 1,
    dataCriacao: '2026-10-29T14:30:00Z',
    dataAtualizacao: '2026-10-29T14:30:00Z',
    solicitante: {
      id: 'usr-02',
      nome: 'Mariana Costa',
      cargo: 'Especialista SecOps',
    },
    anexos: [
      {
        id: 'att-02',
        nome: 'Escopo_Tecnico_Pentest.pdf',
        tamanho: '2.1 MB',
        tipo: 'application/pdf',
        icone: 'picture_as_pdf',
      },
    ],
    fluxoDestinado: {
      nome: 'Alçada N3 — Diretoria Executiva',
      totalEtapas: 2,
      etapaAtualNumero: 2,
      etapaAtualNome: 'Aguardando aprovador',
      etapas: [
        { numero: 1, nome: 'Submissão', papel: 'Solicitante', status: 'CONCLUIDA', dataHora: '29/10/2026 14:30' },
        { numero: 2, nome: 'Decisão N3', papel: 'Diretor CFO', status: 'EM_ANALISE' },
      ],
    },
  },
  {
    id: 'sol-seed-003',
    codigo: '#SOL-003',
    titulo: 'Aquisição de Monitores Ultrawide para Estações de Trabalho',
    descricao: 'Substituição de monitores com defeito na operação clínica.',
    categoria: 'EQUIPAMENTOS',
    categoriaLabel: 'Equipamentos',
    categoriaIcon: 'devices',
    categoriaColor: '#644ef3',
    centroCustoId: 'cc-clinica-centro',
    centroCustoNome: 'Clínica Centro',
    departamento: 'Operações',
    valor: 4800,
    prioridade: 'MEDIA',
    status: 'EM_AJUSTE',
    statusLabel: 'Ajuste solicitado',
    statusIcon: 'edit_note',
    versao: 2,
    dataCriacao: '2026-10-25T09:00:00Z',
    dataAtualizacao: '2026-10-26T11:20:00Z',
    solicitante: {
      id: 'usr-03',
      nome: 'Rafael Souza',
      cargo: 'Coordenador de Operações',
    },
    anexos: [
      {
        id: 'att-03',
        nome: 'Cotacao_Monitores_Dell.pdf',
        tamanho: '890 KB',
        tipo: 'application/pdf',
        icone: 'picture_as_pdf',
      },
    ],
    fluxoDestinado: {
      nome: 'Alçada N2 — Gerência Operacional',
      totalEtapas: 2,
      etapaAtualNumero: 2,
      etapaAtualNome: 'Aguardando ajuste do solicitante',
      etapas: [
        { numero: 1, nome: 'Submissão', papel: 'Solicitante', status: 'CONCLUIDA', dataHora: '25/10/2026 09:00' },
        {
          numero: 2,
          nome: 'Decisão N2',
          papel: 'Gerente Operacional',
          status: 'AJUSTE',
          comentario: 'Favor anexar mais duas cotações comparativas.',
        },
      ],
    },
  },
  {
    id: 'sol-seed-004',
    codigo: '#SOL-004',
    titulo: 'Reposição de Suprimentos e Material de Escritório',
    descricao: 'Compra trimestral de papelaria e insumos administrativos.',
    categoria: 'MATERIAL_ESCRITORIO',
    categoriaLabel: 'Material de Escritório',
    categoriaIcon: 'inventory_2',
    categoriaColor: '#16a34a',
    centroCustoId: 'cc-fin',
    centroCustoNome: 'Controladoria & Finanças',
    departamento: 'Financeiro',
    valor: 950,
    prioridade: 'BAIXA',
    status: 'APROVADA',
    statusLabel: 'Aprovada',
    statusIcon: 'check_circle',
    versao: 2,
    dataCriacao: '2026-10-20T16:00:00Z',
    dataAtualizacao: '2026-10-21T10:00:00Z',
    solicitante: {
      id: 'usr-04',
      nome: 'Beatriz Lima',
      cargo: 'Analista Financeiro',
    },
    anexos: [],
    fluxoDestinado: {
      nome: 'Alçada N1 — Coordenação',
      totalEtapas: 2,
      etapaAtualNumero: 2,
      etapaAtualNome: 'Aprovada',
      etapas: [
        { numero: 1, nome: 'Submissão', papel: 'Solicitante', status: 'CONCLUIDA', dataHora: '20/10/2026 16:00' },
        { numero: 2, nome: 'Decisão N1', papel: 'Coordenador', status: 'CONCLUIDA', dataHora: '21/10/2026 10:00' },
      ],
    },
  },
];

/**
 * Estado da Central de Solicitações e Aprovações ligado à API (Jornadas 1 a 3 e 5):
 * lista e submissão (`/solicitacoes`), centros de custo e tetos (`/centros-custo`, `/alcadas/tetos`),
 * decisões do aprovador e trilha.
 */
@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly authService = inject(AuthService, { optional: true });
  private readonly settingsService = inject(SettingsService, { optional: true });
  private readonly apiBaseUrl = inject(APP_CONFIG, { optional: true })?.apiBaseUrl ?? '/api';

  readonly categories = CATEGORY_OPTIONS;

  private readonly _requests = signal<RequestItem[]>([]);
  private readonly _costCenters = signal<CostCenterOption[]>([]);
  private readonly _tiers = signal<ApprovalTier[]>([]);
  private readonly _loadState = signal<LoadState>('carregando');
  private readonly _loadError = signal<string | null>(null);

  /** Popula dados de exemplo apenas para testes unitários isolados de componentes. */
  seedForTesting(): void {
    this._requests.set(INITIAL_SEED_REQUESTS);
    this._costCenters.set(INITIAL_COST_CENTERS);
  }

  readonly requests = this._requests.asReadonly();
  readonly costCenters = this._costCenters.asReadonly();
  readonly tiers = this._tiers.asReadonly();
  readonly loadState = this._loadState.asReadonly();
  readonly loadError = this._loadError.asReadonly();

  readonly stats = computed<RequestStats>(() => calcularIndicadores(this._requests()));

  /**
   * Sincroniza os centros de custo locais com os departamentos cadastrados na organização ativa
   * e dispara a leitura da API quando o usuário está autenticado.
   */
  ensureLoaded(): void {
    this.syncCostCentersFromOrganization();
    if (this.http && this.authService?.isAuthenticated?.()) {
      this.load();
    }
  }

  syncCostCentersFromOrganization(): void {
    const depts = this.settingsService?.organization().departments ?? [];
    if (depts.length > 0) {
      this._costCenters.set(
        depts.map((d) => ({
          id: d.id,
          code: d.costCenter || d.code,
          nome: d.name,
          departamento: d.name,
        })),
      );
    }
  }

  /**
   * Carrega solicitações, centros de custo e tetos. Centros e tetos são complementares:
   * se falharem, a lista aparece mesmo assim (com nomes/alçadas genéricos).
   */
  load(): void {
    if (!this.http) {
      this._loadState.set('pronto');
      return;
    }

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
        if (centros.length > 0) {
          this._costCenters.set(centros.map((c) => ({ id: c.id, code: c.code, nome: c.name })));
        } else if (this._costCenters().length === 0) {
          this.syncCostCentersFromOrganization();
        }
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
    if (!this.http) {
      const item = this.createRequest(dto);
      return of(item);
    }
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
    if (!this.http) {
      return of(request);
    }
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
    if (!this.http) {
      const found = this.getRequestById(id);
      return of(found?.fluxoDestinado.etapas ?? []);
    }
    return this.http
      .get<EloAuditoriaDto[]>(`${this.apiBaseUrl}/solicitacoes/${encodeURIComponent(id)}/trilha`)
      .pipe(map(etapasDaTrilha));
  }

  getRequestById(id: string): RequestItem | undefined {
    return this._requests().find((r) => r.id === id);
  }

  calculateSuggestedWorkflow(
    valor: number,
    centroCustoId?: string,
    categoria?: string,
  ): WorkflowDestination {
    void centroCustoId;
    void categoria;
    return fluxoDaAlcada(valor, 'PENDENTE', this._tiers());
  }

  createRequest(payload: CreateRequestFormPayload): RequestItem {
    const agora = new Date().toISOString();
    const id = `sol-${Math.random().toString(36).slice(2, 8)}`;
    const justificativaCompleta = payload.titulo
      ? `${payload.titulo} — ${payload.justificativa}`
      : payload.justificativa;

    const user = this.authService?.currentUser();
    const dtoMock: SolicitacaoResponseDto = {
      id,
      tenantId: user?.tenantId ?? 'startop',
      centroCustoId: payload.centroCustoId,
      solicitanteId: user?.id ?? 'voce',
      valor: payload.valor,
      categoria: payload.categoria,
      justificativa: justificativaCompleta,
      fornecedor: payload.fornecedor,
      status: 'PENDENTE',
      versao: 1,
      alertaRisco: null,
      createdAt: agora,
      updatedAt: agora,
      ...({
        solicitanteNome: user?.name,
        solicitanteCargo: user?.profissaoNome || user?.role || 'Solicitante',
      }),
    };

    const novoItem: RequestItem = {
      ...paraRequestItem(dtoMock, this.contexto()),
      titulo: payload.titulo || paraRequestItem(dtoMock, this.contexto()).titulo,
      prioridade: payload.prioridade ?? inferirPrioridade(payload.valor),
      solicitante: {
        id: user?.id ?? 'voce',
        nome: user?.name || 'Você',
        cargo: user?.profissaoNome || user?.role || 'Solicitante',
      },
      anexos: (payload.anexos ?? []).map((att, idx) => ({
        id: `att-${id}-${idx}`,
        nome: att.nome,
        tamanho: att.tamanho,
        tipo: att.tipo,
        icone: 'picture_as_pdf',
      })),
    };

    this._requests.update((lista) => [novoItem, ...lista]);

    // Se houver sessão autenticada na API, envia de forma assíncrona ao backend
    if (this.http && this.authService?.isAuthenticated?.()) {
      this.http
        .post<SolicitacaoResponseDto>(`${this.apiBaseUrl}/solicitacoes`, {
          centroCustoId: payload.centroCustoId,
          categoria: payload.categoria,
          valor: payload.valor,
          justificativa: justificativaCompleta,
          fornecedor: payload.fornecedor,
          fluxoId: payload.fluxoId,
          fluxoNome: payload.fluxoNome,
          solicitanteNome: user?.name,
          solicitanteCargo: user?.profissaoNome || user?.role || 'Solicitante',
        })
        .pipe(catchError(() => of(null)))
        .subscribe((resposta) => {
          if (resposta) {
            const mapeada = paraRequestItem(resposta, this.contexto());
            this._requests.update((lista) =>
              lista.map((item) => (item.id === id ? { ...novoItem, ...mapeada } : item)),
            );
          }
        });
    }

    return novoItem;
  }

  /**
   * Permite ao solicitante editar/ajustar informações da sua solicitação (título, categoria,
   * centro de custo, valor, justificativa) e reenviá-la para aprovação.
   */
  updateRequest(
    id: string,
    patch: {
      titulo?: string;
      descricao?: string;
      categoria?: string;
      centroCustoId?: string;
      valor?: number;
      fornecedor?: string;
    },
  ): RequestItem | null {
    let atualizado: RequestItem | null = null;
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');

    this._requests.update((lista) =>
      lista.map((req) => {
        if (req.id !== id) return req;

        const novaCategoria = patch.categoria || req.categoria;
        const catInfo =
          this.categories.find((c) => c.id === novaCategoria) ??
          this.categories[0];
        const novoCentroId = patch.centroCustoId || req.centroCustoId;
        const ccInfo = this._costCenters().find((c) => c.id === novoCentroId);
        const novoValor =
          typeof patch.valor === 'number' && patch.valor > 0 ? patch.valor : req.valor;
        const novoTitulo = patch.titulo?.trim() || req.titulo;
        const novaDescricao = patch.descricao?.trim() || req.descricao;
        const novoFluxo = this.calculateSuggestedWorkflow(
          novoValor,
          novoCentroId,
          novaCategoria,
        );

        const etapasAtualizadas = req.fluxoDestinado.etapas.map((step) => {
          if (step.status === 'AJUSTE') {
            return {
              ...step,
              status: 'EM_ANALISE' as const,
              dataHora: nowFormatted,
              comentario: `Ajuste realizado pelo solicitante (${nowFormatted}): ${novaDescricao}`,
            };
          }
          return step;
        });

        atualizado = {
          ...req,
          titulo: novoTitulo,
          descricao: novaDescricao,
          categoria: novaCategoria,
          categoriaLabel: catInfo?.label ?? req.categoriaLabel,
          categoriaIcon: catInfo?.icon ?? req.categoriaIcon,
          categoriaColor: catInfo?.color ?? req.categoriaColor,
          centroCustoId: novoCentroId,
          centroCustoNome: ccInfo?.nome ?? req.centroCustoNome,
          departamento: ccInfo?.departamento ?? ccInfo?.nome ?? req.departamento,
          valor: novoValor,
          prioridade: inferirPrioridade(novoValor),
          status: 'PENDENTE',
          statusLabel: 'Em análise',
          statusIcon: 'hourglass_top',
          versao: req.versao + 1,
          dataAtualizacao: nowIso,
          fluxoDestinado: {
            ...novoFluxo,
            etapas: etapasAtualizadas.length > 0 ? etapasAtualizadas : novoFluxo.etapas,
          },
        };

        return atualizado;
      }),
    );

    if (atualizado && this.http && this.authService?.isAuthenticated?.()) {
      const reqSnapshot = atualizado as RequestItem;
      const justificativaCompleta =
        reqSnapshot.titulo && !reqSnapshot.descricao.startsWith(reqSnapshot.titulo)
          ? `${reqSnapshot.titulo} — ${reqSnapshot.descricao}`
          : reqSnapshot.descricao;

      this.http
        .put<SolicitacaoResponseDto>(
          `${this.apiBaseUrl}/solicitacoes/${encodeURIComponent(id)}`,
          {
            centroCustoId: reqSnapshot.centroCustoId,
            categoria: reqSnapshot.categoria,
            valor: reqSnapshot.valor,
            justificativa: justificativaCompleta,
            fornecedor: patch.fornecedor,
          },
        )
        .pipe(catchError(() => of(null)))
        .subscribe((resposta) => {
          if (resposta) {
            const mapeada = paraRequestItem(resposta, this.contexto());
            this._requests.update((lista) =>
              lista.map((item) =>
                item.id === id
                  ? {
                      ...reqSnapshot,
                      ...mapeada,
                      titulo: reqSnapshot.titulo,
                      descricao: reqSnapshot.descricao,
                    }
                  : item,
              ),
            );
          }
        });
    }

    return atualizado;
  }

  approveRequest(
    id: string,
    signatureImg?: string,
    comentario?: string,
    signatario = 'Diretoria Executiva / Aprovador',
  ): boolean {
    let updated = false;
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');
    const randomHash =
      Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('') +
      '...' +
      Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const target = this.getRequestById(id);

    this._requests.update((list) =>
      list.map((req) => {
        if (req.id !== id) return req;
        updated = true;

        const etapaAtual = req.etapaAtual ?? 1;
        const totalEtapas = req.totalEtapas ?? 1;
        const isAvanco = etapaAtual < totalEtapas;

        const currentStepIndex = req.fluxoDestinado.etapas.findIndex(
          (e) => e.status === 'PENDENTE' || e.status === 'EM_ANALISE' || e.status === 'AJUSTE',
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
          if (isAvanco && idx === currentStepIndex + 1) {
            return {
              ...step,
              status: 'EM_ANALISE' as const,
            };
          }
          return step;
        });

        if (isAvanco) {
          const proximaEtapa = etapaAtual + 1;
          const proximoPapel = proximaEtapa === 2 ? 'APROVADOR_N2' : 'DIRETOR_CFO';
          return {
            ...req,
            etapaAtual: proximaEtapa,
            aprovadorEsperadoPapel: proximoPapel,
            status: 'PENDENTE' as const,
            statusLabel: 'Em análise',
            statusIcon: 'hourglass_top',
            versao: req.versao + 1,
            dataAtualizacao: nowIso,
            fluxoDestinado: {
              ...req.fluxoDestinado,
              etapaAtualNumero: proximaEtapa + 1,
              etapaAtualNome: 'Aguardando próximo nível',
              etapas: updatedEtapas,
            },
          };
        }

        return {
          ...req,
          status: 'APROVADA' as const,
          statusLabel: 'Aprovada',
          statusIcon: 'check_circle',
          versao: req.versao + 1,
          dataAtualizacao: nowIso,
          fluxoDestinado: {
            ...req.fluxoDestinado,
            etapaAtualNumero: req.fluxoDestinado.totalEtapas,
            etapaAtualNome: 'Aprovada',
            etapas: updatedEtapas,
          },
        };
      }),
    );

    if (target && this.http && this.authService?.isAuthenticated?.()) {
      this.decide(target, 'aprovar').pipe(catchError(() => of(null))).subscribe();
    }

    return updated;
  }

  validateRequest(
    id: string,
    parecer = 'Validado tecnicamente conforme normas corporativas e orçamentos anexados.',
    autor = 'Auditoria & Compliance',
  ): boolean {
    let updated = false;
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');

    this._requests.update((list) =>
      list.map((req) => {
        if (req.id !== id) return req;
        updated = true;

        const currentStepIndex = req.fluxoDestinado.etapas.findIndex(
          (e) => e.status === 'PENDENTE' || e.status === 'EM_ANALISE' || e.status === 'AJUSTE',
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
      }),
    );
    return updated;
  }

  requestAdjustment(id: string, motivo: string, autor = 'Comitê de Alçadas'): boolean {
    let updated = false;
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');
    const target = this.getRequestById(id);

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
          status: 'EM_AJUSTE' as const,
          statusLabel: 'Ajuste solicitado',
          statusIcon: 'edit_note',
          versao: req.versao + 1,
          dataAtualizacao: nowIso,
          fluxoDestinado: {
            ...req.fluxoDestinado,
            etapaAtualNome: 'Aguardando ajuste do solicitante',
            etapas: updatedEtapas,
          },
        };
      }),
    );

    if (target && this.http && this.authService?.isAuthenticated?.()) {
      this.decide(target, 'ajuste', motivo).pipe(catchError(() => of(null))).subscribe();
    }

    return updated;
  }

  rejectRequest(id: string, motivo: string, autor = 'Diretoria de Alçadas'): boolean {
    let updated = false;
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString('pt-BR');
    const target = this.getRequestById(id);

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
          statusLabel: 'Rejeitada',
          statusIcon: 'cancel',
          versao: req.versao + 1,
          dataAtualizacao: nowIso,
          fluxoDestinado: {
            ...req.fluxoDestinado,
            etapaAtualNome: 'Rejeitada',
            etapas: updatedEtapas,
          },
        };
      }),
    );

    if (target && this.http && this.authService?.isAuthenticated?.()) {
      this.decide(target, 'rejeitar', motivo).pipe(catchError(() => of(null))).subscribe();
    }

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

  private contexto(): ContextoDoMapeamento {
    const user = this.authService?.currentUser();
    return {
      centrosDeCusto: this._costCenters(),
      tetos: this._tiers(),
      usuarioAtualId: user?.id,
      usuarioAtualNome: user?.name,
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
}
