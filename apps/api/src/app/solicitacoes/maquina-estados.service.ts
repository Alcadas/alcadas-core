import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  SolicitacaoResponseDto,
  StatusSolicitacao,
} from '@alcadas-core/models';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConflitoDeVersaoError, FirestoreService } from '../database/firestore.service';
import {
  AcaoSolicitacao,
  ERRO_CONFLITO_VERSAO,
  Transicao,
  assertVersao,
  resolverTransicao,
} from './maquina-estados';

export const REQUESTS_COLLECTION = 'requests';
export const SOLICITACOES_COLLECTION_ALIAS = 'solicitacoes';

export interface ExecutarTransicaoParams {
  user: AuthenticatedUser;
  solicitacaoId: string;
  acao: AcaoSolicitacao;
  versaoInformada: unknown;
  /** Guardas de negócio (SoD, alçada…). Devem lançar exceção HTTP para negar. */
  validar?: (solicitacao: SolicitacaoResponseDto, transicao: Transicao) => Promise<void> | void;
  /** Campos extras gravados junto com a mudança de status. */
  alteracoes?: (solicitacao: SolicitacaoResponseDto) => Partial<SolicitacaoResponseDto>;
  /** Dados da ação gravados no elo da trilha. */
  payload: (solicitacao: SolicitacaoResponseDto) => Record<string, unknown>;
}

/**
 * Único ponto do sistema autorizado a mudar o `status` de uma solicitação (ADR-005).
 *
 * Ordem fixa de verificação:
 *  1. solicitação existe no tenant do usuário (404 / 403 — N08);
 *  2. a transição (estado atual, ação) existe na tabela T01–T06 (409 — N05/N06);
 *  3. a versão informada é a atual (409 — N04);
 *  4. guardas de negócio do caso de uso (403 — N01/N02);
 *  5. escrita condicional por versão no Firestore (409 se outra decisão gravou antes — US-05);
 *  6. elo SHA-256 na trilha (US-07).
 */
@Injectable()
export class MaquinaEstadosService {
  constructor(
    private readonly firestore: FirestoreService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(params: ExecutarTransicaoParams): Promise<SolicitacaoResponseDto> {
    const { user } = params;
    const { solicitacao, collectionUsed } = await this.buscarNoTenant(
      user.tenantId,
      params.solicitacaoId,
    );

    const transicao = resolverTransicao(solicitacao.status, params.acao);
    assertVersao(solicitacao.versao, params.versaoInformada);

    if (params.validar) {
      await params.validar(solicitacao, transicao);
    }

    const agora = new Date().toISOString();
    const atualizada: SolicitacaoResponseDto = {
      ...solicitacao,
      ...(params.alteracoes ? params.alteracoes(solicitacao) : {}),
      status: transicao.destino,
      versao: solicitacao.versao + 1,
      updatedAt: agora,
    };

    try {
      await this.firestore.updateTenantDocumentIfVersion(
        user.tenantId,
        collectionUsed,
        solicitacao.id,
        solicitacao.versao,
        atualizada,
      );
    } catch (error) {
      if (error instanceof ConflitoDeVersaoError) {
        throw new ConflictException({
          error: ERRO_CONFLITO_VERSAO,
          message:
            'Conflito de concorrência: outra decisão foi registrada nesta solicitação. Recarregue e tente novamente (CA-05.1).',
        });
      }
      throw error;
    }

    if (collectionUsed !== REQUESTS_COLLECTION) {
      // Mantém a coleção canônica do Modelo de Dados sincronizada.
      await this.firestore.setTenantDocument(user.tenantId, REQUESTS_COLLECTION, solicitacao.id, atualizada);
    }

    await this.auditoria.recordEvent({
      tenantId: user.tenantId,
      requestId: solicitacao.id,
      tipoEvento: transicao.evento,
      authorId: user.userId,
      authorRole: user.role,
      timestampUtc: agora,
      payload: {
        transicao: transicao.codigo,
        de: solicitacao.status,
        para: transicao.destino,
        versao: atualizada.versao,
        ...params.payload(solicitacao),
      },
    });

    return atualizada;
  }

  /**
   * Busca a solicitação dentro do tenant (coleção canônica `requests` ou alias `solicitacoes`).
   */
  async buscarNoTenant(
    tenantId: string,
    solicitacaoId: string,
  ): Promise<{ solicitacao: SolicitacaoResponseDto; collectionUsed: string }> {
    if (!tenantId) {
      throw new ForbiddenException('Isolamento de Tenant (RNF07): tenantId não identificado.');
    }

    let raw = await this.firestore.getTenantDocument<Record<string, unknown>>(
      tenantId,
      REQUESTS_COLLECTION,
      solicitacaoId,
    );
    let collectionUsed = REQUESTS_COLLECTION;

    if (!raw) {
      raw = await this.firestore.getTenantDocument<Record<string, unknown>>(
        tenantId,
        SOLICITACOES_COLLECTION_ALIAS,
        solicitacaoId,
      );
      collectionUsed = SOLICITACOES_COLLECTION_ALIAS;
    }

    // Isolamento (N08): documento de outro tenant é tratado como inexistente — não vaza existência.
    if (!raw || (raw['tenantId'] && raw['tenantId'] !== tenantId)) {
      throw new NotFoundException(`Solicitação "${solicitacaoId}" não encontrada.`);
    }

    return { solicitacao: normalizarSolicitacao(raw, solicitacaoId, tenantId), collectionUsed };
  }
}

export function normalizarSolicitacao(
  raw: Record<string, unknown>,
  solicitacaoId: string,
  tenantId: string,
): SolicitacaoResponseDto {
  const agora = new Date().toISOString();
  return {
    ...(raw as Partial<SolicitacaoResponseDto>),
    id: (raw['id'] as string) || solicitacaoId,
    tenantId: (raw['tenantId'] as string) || tenantId,
    centroCustoId: (raw['centroCustoId'] as string) || (raw['costCenterId'] as string) || '',
    solicitanteId: (raw['solicitanteId'] as string) || (raw['requesterId'] as string) || '',
    valor: Number(raw['valor'] ?? raw['amount'] ?? 0),
    categoria: (raw['categoria'] as string) || (raw['category'] as string) || '',
    justificativa: (raw['justificativa'] as string) || (raw['justification'] as string) || '',
    ...(raw['fornecedor'] || raw['vendor']
      ? { fornecedor: (raw['fornecedor'] as string) || (raw['vendor'] as string) }
      : {}),
    status: ((raw['status'] as StatusSolicitacao) || 'PENDENTE') as StatusSolicitacao,
    versao: Number(raw['versao'] ?? raw['version'] ?? 1),
    alertaRisco: (raw['alertaRisco'] as string | null) ?? null,
    createdAt: (raw['createdAt'] as string) || agora,
    updatedAt: (raw['updatedAt'] as string) || agora,
  };
}
