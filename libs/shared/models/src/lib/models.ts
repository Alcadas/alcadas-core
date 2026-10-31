export function models(): string {
  return 'models';
}

/**
 * Papéis canônicos do sistema Alçadas (ADR-007).
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
 * Níveis hierárquicos da Matriz de Alçadas (RF01 / RN01).
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
 * Entidade de Faixa/Teto de Alçada lida do Firestore (/tenants/{tenantId}/approval_tiers/{tierId}).
 */
export interface ApprovalTier {
  id: string;
  tenantId: string;
  costCenterId?: string | null;
  level: ApprovalLevel;
  approverRole: UserRole;
  roleTitle?: string;
  minAmount: number;
  maxAmount: number | null;
  unlimited: boolean;
  requiredApprovals?: number;
  updatedAt?: string;
}

/**
 * Representação da Solicitação Financeira conforme OpenAPI v0.1 e Modelo de Dados.
 */
export interface SolicitacaoResponseDto {
  id: string;
  tenantId: string;
  centroCustoId: string;
  solicitanteId: string;
  valor: number;
  categoria: string;
  justificativa: string;
  fornecedor?: string;
  status: StatusSolicitacao;
  versao: number;
  alertaRisco?: string | null;
  aprovadorId?: string;
  decididoPorId?: string;
  motivoDecisao?: string;
  observacaoDecisao?: string;
  createdAt: string;
  updatedAt: string;
}

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
