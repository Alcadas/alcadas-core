export function models(): string {
  return 'models';
}

/**
 * Papéis canônicos do sistema Alçadas (ADR-007 e Modelo de Dados).
 */
export type UserRole =
  | 'SOLICITANTE'
  | 'APROVADOR_N1'
  | 'APROVADOR_N2'
  | 'DIRETOR_CFO'
  | 'USER_NORMAL'
  | 'SUPER_USER'
  | 'AUDITOR'
  | 'ADMIN';

/**
 * Níveis hierárquicos da Matriz de Alçadas (Jornada 1 - RF01 / RN01).
 */
export type ApprovalLevel = 'N1' | 'N2' | 'N3';

/**
 * Estados formais do ciclo de vida de uma solicitação financeira (ADR-005 / OpenAPI v0.1).
 */
export type StatusSolicitacao = 'PENDENTE' | 'EM_AJUSTE' | 'APROVADA' | 'REJEITADA';

/**
 * Catálogo formal de eventos da trilha de auditoria criptográfica SHA-256 (ADR-006 / OpenAPI v0.1).
 */
export type TipoEventoTrilha =
  | 'CRIACAO_SOLICITACAO'
  | 'APROVACAO'
  | 'REJEICAO'
  | 'PEDIDO_AJUSTE'
  | 'REENVIO_SOLICITACAO'
  | 'DELEGACAO_CRIADA'
  | 'DELEGACAO_EXPIRADA'
  | 'BLOQUEIO_SOD'
  | 'BLOQUEIO_FRACIONAMENTO'
  | 'ALERTA_DUPLICIDADE';

/**
 * Usuário autenticado extraído do token JWT (Firebase Auth / RBAC).
 */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email?: string;
  fullName?: string;
  role: UserRole;
  level?: ApprovalLevel;
  maxApprovalLimit?: number | null;
}

/**
 * Entidade de Centro de Custo (Modelo de Dados - /tenants/{tenantId}/cost_centers/{costCenterId}).
 */
export interface CostCenter {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  monthlyBudget?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO para criação de Centro de Custo (Jornada 1 - US-01).
 */
export interface CreateCostCenterDto {
  code?: string;
  codigo?: string;
  name?: string;
  nome?: string;
  monthlyBudget?: number;
  orcamentoMensal?: number;
  isActive?: boolean;
}

/**
 * Entidade de Faixa/Teto de Alçada (Modelo de Dados - /tenants/{tenantId}/approval_tiers/{tierId}).
 */
export interface ApprovalTier {
  id: string;
  tenantId: string;
  costCenterId?: string | null;
  level: ApprovalLevel;
  approverRole: UserRole;
  roleTitle: string;
  minAmount: number;
  maxAmount: number | null;
  unlimited: boolean;
  requiredApprovals: number;
  updatedAt: string;
}

/**
 * Entrada individual para configuração de um nível de alçada (N1, N2 ou N3).
 */
export interface ApprovalTierInputDto {
  level?: ApprovalLevel;
  nivel?: ApprovalLevel;
  approverRole?: UserRole;
  cargo?: string;
  minAmount?: number;
  valorMinimo?: number;
  maxAmount?: number | null;
  teto?: number | null;
  unlimited?: boolean;
  semLimite?: boolean;
  requiredApprovals?: number;
}

/**
 * DTO flexível para configurar a Matriz de Alçadas (N1, N2, N3) de um tenant ou centro de custo.
 * Suporta tanto envio em lista (`tiers`) quanto objeto direto (`N1`, `N2`, `N3`).
 */
export interface UpsertApprovalMatrixDto {
  costCenterId?: string | null;
  centroCustoId?: string | null;
  tiers?: ApprovalTierInputDto[];
  N1?: number | ApprovalTierInputDto | null;
  N2?: number | ApprovalTierInputDto | null;
  N3?: number | ApprovalTierInputDto | null;
}

/**
 * DTO de entrada para verificar se um cargo/nível pode decidir um valor (CA-01.2).
 */
export interface EvaluateTierCompetenceDto {
  amount?: number;
  valor?: number;
  level?: ApprovalLevel;
  nivel?: ApprovalLevel;
  role?: UserRole;
  cargo?: string;
  costCenterId?: string | null;
  centroCustoId?: string | null;
}

/**
 * Resposta da avaliação de alçada para um pedido (CA-01.2).
 */
/**
 * Resposta da avaliação de alçada para um pedido (CA-01.2).
 */
export interface EvaluateTierCompetenceResponseDto {
  allowed: boolean;
  amount: number;
  actorLevel: ApprovalLevel;
  actorMaxAmount: number | null;
  requiredLevel: ApprovalLevel;
  requiredRole: UserRole;
  escalated: boolean;
  message: string;
} // <- Aqui está a chave de fechamento que faltava

/**
 * DTO para decisão de Aprovação (T02 - POST /api/solicitacoes/{id}/aprovar).
 */
export interface DecisaoAprovacaoDto {
  versao?: number;
  observacao?: string;
}

/**
 * DTO para decisão de Rejeição (T03 - POST /api/solicitacoes/{id}/rejeitar).
 * Exige motivo com no mínimo 10 caracteres (CA-03.2).
 */
export interface DecisaoRejeicaoDto {
  versao?: number;
  motivo: string;
}

/**
 * DTO para decisão de Solicitação de Ajuste (T04 - POST /api/solicitacoes/{id}/ajuste).
 * Exige motivo com no mínimo 10 caracteres (CA-03.2).
 */
export interface DecisaoAjusteDto {
  versao?: number;
  motivo: string;
}

/**
 * Elo imutável da Trilha de Auditoria Criptográfica SHA-256 (ADR-006 / OpenAPI v0.1).
 */
export interface EloAuditoriaDto {
  sequencia: number;
  hashAtual: string;
  hashAnterior: string;
  tipoEvento: TipoEventoTrilha;
  authorId: string;
  authorRole?: string;
  timestampUtc: string;
  payload: Record<string, unknown>;
}

/**
 * Contrato padronizado de erro HTTP (OpenAPI v0.1).
 */
export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
}
