import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalLevel,
  ApprovalTier,
  AuthenticatedUser,
  DecisaoAjusteDto,
  DecisaoAprovacaoDto,
  DecisaoRejeicaoDto,
  SolicitacaoResponseDto,
  StatusSolicitacao,
} from '@alcadas-core/models';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { FirestoreService } from '../database/firestore.service';

const REQUESTS_COLLECTION = 'requests';
const SOLICITACOES_COLLECTION_ALIAS = 'solicitacoes';
const APPROVAL_TIERS_COLLECTION = 'approval_tiers';

const APPROVER_ROLES = new Set([
  'APROVADOR_N1',
  'APROVADOR_N2',
  'DIRETOR_CFO',
  'USER_NORMAL',
  'SUPER_USER',
]);

const DEFAULT_CEILING_BY_LEVEL: Record<ApprovalLevel, number | null> = {
  N1: 1000.0,
  N2: 5000.0,
  N3: null, // Diretoria Executiva / CFO sem limite superior
};

/**
 * Serviço responsável pela Máquina de Estados e Decisões do Aprovador (Jornada 3 - RF03 / US-03 / T02 a T04).
 */
@Injectable()
export class SolicitacoesService {
  // Lock atômico em memória por solicitação para impedir condições de corrida simultâneas (RF11 / RN11 / US-05)
  private readonly activeLocks = new Set<string>();

  constructor(
    private readonly firestore: FirestoreService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * T02: Aprovar solicitação financeira (POST /api/solicitacoes/{id}/aprovar).
   * - Confere estado PENDENTE (409 se já APROVADA/REJEITADA - CA-03.4)
   * - Confere versão OCC (409 se conflito - CA-05.1)
   * - Confere Segregação de Funções / SoD (403 se autor == aprovador - RN03 / US-04)
   * - Confere teto de alçada do aprovador (403 se valor > teto, mantendo PENDENTE - CA-03.1)
   * - Avança para APROVADA, grava o ID do autor e gera o elo Log 2 (APROVACAO) na trilha (CA-03.3)
   */
  async aprovarSolicitacao(
    user: AuthenticatedUser,
    solicitacaoId: string,
    dto: DecisaoAprovacaoDto = {},
  ): Promise<SolicitacaoResponseDto> {
    this.assertAuthenticatedTenant(user);

    return this.executeWithAtomicLock(user.tenantId, solicitacaoId, async () => {
      const { solicitacao, collectionUsed } = await this.findSolicitacaoInTenant(
        user.tenantId,
        solicitacaoId,
      );

      // 1. Valida estado atual e Controle de Concorrência Otimista (CA-03.4 / CA-05.1 / N04-N06)
      this.assertStateIsPendingAndVersionMatches(solicitacao, dto?.versao);

      // 2. Valida Segregação de Funções - SoD (RN03 / US-04 / N01)
      await this.assertSegregationOfDuties(user, solicitacao);

      // 3. Confere papel e teto de alçada do aprovador (CA-03.1 / N02)
      const { level, maxAmount } = await this.assertApproverWithinCeiling(
        user,
        solicitacao,
      );

      // 4. Transição PENDENTE -> APROVADA e persistência no Firestore Emulator (CA-03.3)
      const now = new Date().toISOString();
      const updated: SolicitacaoResponseDto = {
        ...solicitacao,
        status: 'APROVADA',
        versao: (solicitacao.versao ?? 1) + 1,
        aprovadorId: user.userId,
        decididoPorId: user.userId,
        ...(dto?.observacao ? { observacaoDecisao: dto.observacao.trim() } : {}),
        updatedAt: now,
      };

      await this.persistSolicitacao(user.tenantId, collectionUsed, updated);

      // 5. Grava Elo SHA-256 na Trilha de Auditoria (Log 2: APROVACAO)
      await this.auditoria.recordEvent({
        tenantId: user.tenantId,
        requestId: solicitacao.id,
        tipoEvento: 'APROVACAO',
        authorId: user.userId,
        authorRole: user.role,
        timestampUtc: now,
        payload: {
          solicitacaoId: solicitacao.id,
          aprovadorId: user.userId,
          cargo: user.role,
          nivelAlcada: level,
          limiteAlcada: maxAmount,
          valor: solicitacao.valor,
          observacao: dto?.observacao?.trim() ?? null,
        },
      });

      return updated;
    });
  }

  /**
   * T03: Rejeitar solicitação financeira (POST /api/solicitacoes/{id}/rejeitar).
   * - Exige motivo de no mínimo 10 caracteres (com 9 caracteres recusa com 400 - CA-03.2 / N07)
   * - Confere estado PENDENTE e versão OCC (409 - CA-03.4)
   * - Confere SoD e teto de alçada do aprovador (403 - CA-03.1)
   * - Avança para REJEITADA, grava o ID do autor e gera o elo Log 3 (REJEICAO) na trilha (CA-03.3)
   */
  async rejeitarSolicitacao(
    user: AuthenticatedUser,
    solicitacaoId: string,
    dto: DecisaoRejeicaoDto,
  ): Promise<SolicitacaoResponseDto> {
    this.assertAuthenticatedTenant(user);
    const motivo = this.validateDecisionReason(dto?.motivo, 'rejeição');

    return this.executeWithAtomicLock(user.tenantId, solicitacaoId, async () => {
      const { solicitacao, collectionUsed } = await this.findSolicitacaoInTenant(
        user.tenantId,
        solicitacaoId,
      );

      // 1. Valida estado atual e OCC (CA-03.4 / CA-05.1)
      this.assertStateIsPendingAndVersionMatches(solicitacao, dto?.versao);

      // 2. Valida Segregação de Funções - SoD (RN03)
      await this.assertSegregationOfDuties(user, solicitacao);

      // 3. Confere teto de alçada do aprovador (CA-03.1)
      await this.assertApproverWithinCeiling(user, solicitacao);

      // 4. Transição PENDENTE -> REJEITADA e persistência no Firestore Emulator (CA-03.3)
      const now = new Date().toISOString();
      const updated: SolicitacaoResponseDto = {
        ...solicitacao,
        status: 'REJEITADA',
        versao: (solicitacao.versao ?? 1) + 1,
        aprovadorId: user.userId,
        decididoPorId: user.userId,
        motivoDecisao: motivo,
        updatedAt: now,
      };

      await this.persistSolicitacao(user.tenantId, collectionUsed, updated);

      // 5. Grava Elo SHA-256 na Trilha de Auditoria (Log 3: REJEICAO)
      await this.auditoria.recordEvent({
        tenantId: user.tenantId,
        requestId: solicitacao.id,
        tipoEvento: 'REJEICAO',
        authorId: user.userId,
        authorRole: user.role,
        timestampUtc: now,
        payload: {
          solicitacaoId: solicitacao.id,
          aprovadorId: user.userId,
          motivo,
        },
      });

      return updated;
    });
  }

  /**
   * T04: Solicitar ajuste na solicitação (POST /api/solicitacoes/{id}/ajuste).
   * - Exige motivo de no mínimo 10 caracteres (com 9 caracteres recusa com 400 - CA-03.2 / N07)
   * - Confere estado PENDENTE e versão OCC (409 - CA-03.4)
   * - Confere SoD e teto de alçada do aprovador (403 - CA-03.1)
   * - Avança para EM_AJUSTE, grava o ID do autor e gera o elo Log 4 (PEDIDO_AJUSTE) na trilha (CA-03.3)
   */
  async solicitarAjuste(
    user: AuthenticatedUser,
    solicitacaoId: string,
    dto: DecisaoAjusteDto,
  ): Promise<SolicitacaoResponseDto> {
    this.assertAuthenticatedTenant(user);
    const motivo = this.validateDecisionReason(dto?.motivo, 'solicitação de ajuste');

    return this.executeWithAtomicLock(user.tenantId, solicitacaoId, async () => {
      const { solicitacao, collectionUsed } = await this.findSolicitacaoInTenant(
        user.tenantId,
        solicitacaoId,
      );

      // 1. Valida estado atual e OCC (CA-03.4 / CA-05.1)
      this.assertStateIsPendingAndVersionMatches(solicitacao, dto?.versao);

      // 2. Valida Segregação de Funções - SoD (RN03)
      await this.assertSegregationOfDuties(user, solicitacao);

      // 3. Confere teto de alçada do aprovador (CA-03.1)
      await this.assertApproverWithinCeiling(user, solicitacao);

      // 4. Transição PENDENTE -> EM_AJUSTE e persistência no Firestore Emulator (CA-03.3)
      const now = new Date().toISOString();
      const updated: SolicitacaoResponseDto = {
        ...solicitacao,
        status: 'EM_AJUSTE',
        versao: (solicitacao.versao ?? 1) + 1,
        aprovadorId: user.userId,
        decididoPorId: user.userId,
        motivoDecisao: motivo,
        updatedAt: now,
      };

      await this.persistSolicitacao(user.tenantId, collectionUsed, updated);

      // 5. Grava Elo SHA-256 na Trilha de Auditoria (Log 4: PEDIDO_AJUSTE)
      await this.auditoria.recordEvent({
        tenantId: user.tenantId,
        requestId: solicitacao.id,
        tipoEvento: 'PEDIDO_AJUSTE',
        authorId: user.userId,
        authorRole: user.role,
        timestampUtc: now,
        payload: {
          solicitacaoId: solicitacao.id,
          aprovadorId: user.userId,
          motivo,
        },
      });

      return updated;
    });
  }

  /**
   * Valida motivo de rejeição ou solicitação de ajuste (CA-03.2 / N07):
   * - Exige no mínimo 10 caracteres úteis (ex.: "Sem verba" tem 9 chars -> 400 Bad Request;
   *   "Fora do orçamento" tem 17 chars -> aceito).
   */
  private validateDecisionReason(rawMotivo: unknown, actionLabel: string): string {
    if (typeof rawMotivo !== 'string') {
      throw new BadRequestException(
        `CA-03.2: O motivo de ${actionLabel} é obrigatório e deve ter no mínimo 10 caracteres.`,
      );
    }

    const trimmed = rawMotivo.trim();
    if (trimmed.length < 10) {
      throw new BadRequestException(
        `CA-03.2: O motivo de ${actionLabel} deve possuir no mínimo 10 caracteres (informado: ${trimmed.length}).`,
      );
    }

    return trimmed;
  }

  /**
   * Valida Máquina de Estados (CA-03.4 / N05 / N06) e Controle de Concorrência Otimista (CA-05.1 / N04).
   */
  private assertStateIsPendingAndVersionMatches(
    solicitacao: SolicitacaoResponseDto,
    expectedVersion?: number,
  ): void {
    if (solicitacao.status !== 'PENDENTE') {
      throw new ConflictException(
        `CA-03.4: Transição inválida. A solicitação já se encontra no estado ${solicitacao.status} e não aceita nova decisão.`,
      );
    }

    if (
      expectedVersion !== undefined &&
      expectedVersion !== null &&
      expectedVersion !== solicitacao.versao
    ) {
      throw new ConflictException(
        `CA-05.1: Conflito de concorrência (OCC). Versão esperada (${expectedVersion}) diverge da versão atual (${solicitacao.versao}).`,
      );
    }
  }

  /**
   * Valida Segregação de Funções - SoD (RN03 / US-04 / N01):
   * O solicitante jamais pode decidir sobre o próprio pedido.
   */
  private async assertSegregationOfDuties(
    user: AuthenticatedUser,
    solicitacao: SolicitacaoResponseDto,
  ): Promise<void> {
    if (solicitacao.solicitanteId && solicitacao.solicitanteId === user.userId) {
      await this.auditoria.recordEvent({
        tenantId: user.tenantId,
        requestId: solicitacao.id,
        tipoEvento: 'BLOQUEIO_SOD',
        authorId: user.userId,
        authorRole: user.role,
        payload: {
          solicitacaoId: solicitacao.id,
          tentativaAprovadorId: user.userId,
          motivoBloqueio: 'SOD_AUTOAPROVACAO',
        },
      });

      throw new ForbiddenException(
        'SoD: O solicitante está estritamente proibido de aprovar ou decidir a própria solicitação.',
      );
    }
  }

  /**
   * Confere se o aprovador possui papel habilitado e se o valor da solicitação está dentro
   * do teto configurado para o seu cargo/nível no tenant (CA-03.1 / CA-01.2 / N02).
   */
  private async assertApproverWithinCeiling(
    user: AuthenticatedUser,
    solicitacao: SolicitacaoResponseDto,
  ): Promise<{ level: ApprovalLevel; maxAmount: number | null }> {
    if (!APPROVER_ROLES.has(user.role)) {
      throw new ForbiddenException(
        `RBAC (CA-09.1): O papel ${user.role} não possui competência para decidir solicitações financeiras.`,
      );
    }

    const level: ApprovalLevel =
      user.level ??
      (user.role === 'APROVADOR_N1'
        ? 'N1'
        : user.role === 'DIRETOR_CFO' || user.role === 'SUPER_USER'
          ? 'N3'
          : 'N2');

    // 1. Verifica se há teto explícito no token do aprovador ou nas faixas salvas no Firestore do tenant
    let maxAmount: number | null | undefined = user.maxApprovalLimit;
    let unlimited = level === 'N3' && maxAmount === undefined;

    if (maxAmount === undefined) {
      const configuredTiers = await this.firestore.listTenantCollection<ApprovalTier>(
        user.tenantId,
        APPROVAL_TIERS_COLLECTION,
      );

      const matchingTier =
        configuredTiers.find(
          (t) => t.level === level && t.costCenterId === solicitacao.centroCustoId,
        ) ?? configuredTiers.find((t) => t.level === level && !t.costCenterId);

      if (matchingTier) {
        maxAmount = matchingTier.maxAmount;
        unlimited = matchingTier.unlimited || matchingTier.maxAmount === null;
      } else {
        maxAmount = DEFAULT_CEILING_BY_LEVEL[level];
        unlimited = maxAmount === null;
      }
    }

    if (!unlimited && maxAmount !== null && solicitacao.valor > maxAmount) {
      throw new ForbiddenException(
        `CA-03.1: O valor da solicitação (R$ ${solicitacao.valor.toFixed(2)}) ultrapassa o teto de alçada do aprovador (${level}: R$ ${maxAmount.toFixed(2)}). O pedido permanece PENDENTE para o nível superior.`,
      );
    }

    return { level, maxAmount: maxAmount ?? null };
  }

  /**
   * Busca a solicitação dentro do tenant no Firestore Emulator (suportando tanto a coleção
   * 'requests' do Modelo de Dados quanto 'solicitacoes' do OpenAPI, mapeando campos em PT/EN).
   */
  private async findSolicitacaoInTenant(
    tenantId: string,
    solicitacaoId: string,
  ): Promise<{ solicitacao: SolicitacaoResponseDto; collectionUsed: string }> {
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
      if (raw) {
        collectionUsed = SOLICITACOES_COLLECTION_ALIAS;
      }
    }

    if (!raw) {
      throw new NotFoundException(
        `Solicitação "${solicitacaoId}" não encontrada na organização (${tenantId}).`,
      );
    }

    if (raw['tenantId'] && raw['tenantId'] !== tenantId) {
      throw new ForbiddenException(
        'Isolamento de Tenant (RNF07): Acesso proibido a solicitação de outra organização.',
      );
    }

    const normalized: SolicitacaoResponseDto = {
      id: (raw['id'] as string) || solicitacaoId,
      tenantId: (raw['tenantId'] as string) || tenantId,
      centroCustoId:
        (raw['centroCustoId'] as string) || (raw['costCenterId'] as string) || '',
      solicitanteId:
        (raw['solicitanteId'] as string) || (raw['requesterId'] as string) || '',
      valor: Number(raw['valor'] ?? raw['amount'] ?? 0),
      categoria: (raw['categoria'] as string) || (raw['category'] as string) || '',
      justificativa:
        (raw['justificativa'] as string) || (raw['justification'] as string) || '',
      ...(raw['fornecedor'] || raw['vendor']
        ? { fornecedor: (raw['fornecedor'] as string) || (raw['vendor'] as string) }
        : {}),
      status: ((raw['status'] as StatusSolicitacao) || 'PENDENTE') as StatusSolicitacao,
      versao: Number(raw['versao'] ?? raw['version'] ?? 1),
      alertaRisco: (raw['alertaRisco'] as string | null) ?? null,
      createdAt: (raw['createdAt'] as string) || new Date().toISOString(),
      updatedAt: (raw['updatedAt'] as string) || new Date().toISOString(),
    };

    return { solicitacao: normalized, collectionUsed };
  }

  private async persistSolicitacao(
    tenantId: string,
    primaryCollection: string,
    solicitacao: SolicitacaoResponseDto,
  ): Promise<void> {
    await this.firestore.setTenantDocument(
      tenantId,
      primaryCollection,
      solicitacao.id,
      solicitacao,
    );
    // Sincroniza também na coleção canônica 'requests' caso tenha vindo de 'solicitacoes'
    if (primaryCollection !== REQUESTS_COLLECTION) {
      await this.firestore.setTenantDocument(
        tenantId,
        REQUESTS_COLLECTION,
        solicitacao.id,
        solicitacao,
      );
    }
  }

  private async executeWithAtomicLock<T>(
    tenantId: string,
    solicitacaoId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const lockKey = `${tenantId}:${solicitacaoId}`;
    if (this.activeLocks.has(lockKey)) {
      throw new ConflictException(
        'CA-05.1: Decisão concorrente detectada sobre a mesma solicitação.',
      );
    }

    this.activeLocks.add(lockKey);
    try {
      return await operation();
    } finally {
      this.activeLocks.delete(lockKey);
    }
  }

  private assertAuthenticatedTenant(user: AuthenticatedUser): void {
    if (!user || !user.tenantId) {
      throw new ForbiddenException('Isolamento de Tenant (RNF07): tenantId não identificado.');
    }
  }
}
