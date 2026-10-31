export const STATUS_SOLICITACAO = ['PENDENTE', 'EM_AJUSTE', 'APROVADA', 'REJEITADA'] as const;
export type StatusSolicitacao = (typeof STATUS_SOLICITACAO)[number];

export type PapelUsuario =
  | 'SOLICITANTE'
  | 'APROVADOR_N1'
  | 'APROVADOR_N2'
  | 'DIRETOR_CFO'
  | 'AUDITOR'
  | 'ADMIN';

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

export interface CriarSolicitacaoDto {
  centroCustoId: string;
  valor: number;
  categoria: string;
  justificativa: string;
  fornecedor?: string;
}

export interface Solicitacao {
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
  alertaRisco: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EloTrilha {
  solicitacaoId: string;
  sequencia: number;
  tipoEvento: TipoEventoTrilha;
  authorId: string;
  authorRole: string;
  ipOrigem: string;
  timestampUtc: string;
  hashAnterior: string;
  hashAtual: string;
  payload: Record<string, unknown>;
}