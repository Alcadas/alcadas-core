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
 * Status do ciclo de vida da solicitação financeira (ADR-005).
 */
export type RequestStatus = 'PENDENTE' | 'EM_AJUSTE' | 'APROVADA' | 'REJEITADA';

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
export interface EvaluateTierCompetenceResponseDto {
  allowed: boolean;
  amount: number;
  actorLevel: ApprovalLevel;
  actorMaxAmount: number | null;
  requiredLevel: ApprovalLevel;
  requiredRole: UserRole;
  escalated: boolean;
  message: string;
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
