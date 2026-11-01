import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  ApprovalLevel,
  ApprovalTier,
  AuthenticatedUser,
  DecisaoAjusteDto,
  DecisaoAprovacaoDto,
  DecisaoRejeicaoDto,
  EloAuditoriaDto,
  SolicitacaoResponseDto,
} from '@alcadas-core/models';
import { AuditoriaService, VerificacaoTrilhaResultado } from '../auditoria/auditoria.service';
import { FirestoreService } from '../database/firestore.service';
import { MaquinaEstadosService } from './maquina-estados.service';

const APPROVAL_TIERS_COLLECTION = 'approval_tiers';

export const APPROVER_ROLES = new Set([
  'APROVADOR_N1',
  'APROVADOR_N2',
  'DIRETOR_CFO',
  'USER_NORMAL',
  'SUPER_USER',
]);

/** Papéis que leem a trilha de qualquer solicitação do tenant (ADR-007). */
const LEITORES_TRILHA = new Set([...APPROVER_ROLES, 'AUDITOR', 'ADMIN']);

const DEFAULT_CEILING_BY_LEVEL: Record<ApprovalLevel, number | null> = {
  N1: 1000.0,
  N2: 5000.0,
  N3: null, // Diretoria Executiva / CFO sem limite superior
};

/**
 * Casos de uso da Jornada 3 (decisão do aprovador) e da Jornada 5 (trilha).
 * Toda mudança de status passa pela MaquinaEstadosService (ADR-005); este serviço
 * só acrescenta as guardas de negócio — SoD (RN03) e teto de alçada (RN01).
 */
@Injectable()
export class SolicitacoesService {
  constructor(
    private readonly firestore: FirestoreService,
    private readonly auditoria: AuditoriaService,
    private readonly maquinaEstados: MaquinaEstadosService,
  ) {}

  /** T02 — POST /api/solicitacoes/{id}/aprovar */
  async aprovarSolicitacao(
    user: AuthenticatedUser,
    solicitacaoId: string,
    dto: DecisaoAprovacaoDto,
  ): Promise<SolicitacaoResponseDto> {
    let alcada: { level: ApprovalLevel; maxAmount: number | null } | undefined;
    const observacao = typeof dto?.observacao === 'string' ? dto.observacao.trim() : undefined;

    return this.maquinaEstados.executar({
      user,
      solicitacaoId,
      acao: 'APROVAR',
      versaoInformada: dto?.versao,
      validar: async (solicitacao) => {
        await this.assertSegregationOfDuties(user, solicitacao);
        alcada = await this.assertApproverWithinCeiling(user, solicitacao);
      },
      alteracoes: () => ({
        aprovadorId: user.userId,
        decididoPorId: user.userId,
        ...(observacao ? { observacaoDecisao: observacao } : {}),
      }),
      payload: (solicitacao) => ({
        solicitacaoId: solicitacao.id,
        aprovadorId: user.userId,
        cargo: user.role,
        nivelAlcada: alcada?.level ?? null,
        limiteAlcada: alcada?.maxAmount ?? null,
        valor: solicitacao.valor,
        observacao: observacao ?? null,
      }),
    });
  }

  /** T03 — POST /api/solicitacoes/{id}/rejeitar */
  async rejeitarSolicitacao(
    user: AuthenticatedUser,
    solicitacaoId: string,
    dto: DecisaoRejeicaoDto,
  ): Promise<SolicitacaoResponseDto> {
    const motivo = this.validateDecisionReason(dto?.motivo, 'rejeição');
    return this.decidirComMotivo(user, solicitacaoId, 'REJEITAR', dto?.versao, motivo);
  }

  /** T04 — POST /api/solicitacoes/{id}/ajuste */
  async solicitarAjuste(
    user: AuthenticatedUser,
    solicitacaoId: string,
    dto: DecisaoAjusteDto,
  ): Promise<SolicitacaoResponseDto> {
    const motivo = this.validateDecisionReason(dto?.motivo, 'solicitação de ajuste');
    return this.decidirComMotivo(user, solicitacaoId, 'SOLICITAR_AJUSTE', dto?.versao, motivo);
  }

  /** GET /api/solicitacoes/{id}/trilha — elos ordenados por sequência (US-07). */
  async obterTrilha(user: AuthenticatedUser, solicitacaoId: string): Promise<EloAuditoriaDto[]> {
    await this.assertPodeLerTrilha(user, solicitacaoId);
    return this.auditoria.getAuditTrail(user.tenantId, solicitacaoId);
  }

  /** POST /api/solicitacoes/{id}/trilha/verificar — recálculo da cadeia (US-08). */
  async verificarTrilha(
    user: AuthenticatedUser,
    solicitacaoId: string,
  ): Promise<VerificacaoTrilhaResultado> {
    await this.assertPodeLerTrilha(user, solicitacaoId);
    return this.auditoria.verificarCadeia(user.tenantId, solicitacaoId);
  }

  private async decidirComMotivo(
    user: AuthenticatedUser,
    solicitacaoId: string,
    acao: 'REJEITAR' | 'SOLICITAR_AJUSTE',
    versao: unknown,
    motivo: string,
  ): Promise<SolicitacaoResponseDto> {
    return this.maquinaEstados.executar({
      user,
      solicitacaoId,
      acao,
      versaoInformada: versao,
      validar: async (solicitacao) => {
        await this.assertSegregationOfDuties(user, solicitacao);
        await this.assertApproverWithinCeiling(user, solicitacao);
      },
      alteracoes: () => ({
        aprovadorId: user.userId,
        decididoPorId: user.userId,
        motivoDecisao: motivo,
      }),
      payload: (solicitacao) => ({
        solicitacaoId: solicitacao.id,
        aprovadorId: user.userId,
        motivo,
      }),
    });
  }

  /**
   * Leitura da trilha: aprovadores, auditor e admin leem qualquer solicitação do tenant;
   * o solicitante lê apenas as próprias (ADR-007, matriz de permissões).
   */
  private async assertPodeLerTrilha(user: AuthenticatedUser, solicitacaoId: string): Promise<void> {
    const { solicitacao } = await this.maquinaEstados.buscarNoTenant(user.tenantId, solicitacaoId);
    if (LEITORES_TRILHA.has(user.role)) return;
    if (user.role === 'SOLICITANTE' && solicitacao.solicitanteId === user.userId) return;
    throw new ForbiddenException('RBAC: sem permissão para consultar a trilha desta solicitação.');
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
}
