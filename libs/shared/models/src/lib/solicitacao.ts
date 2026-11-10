import { ApprovalLevel, StatusSolicitacao, TipoEventoTrilha } from './models';

export type PapelUsuario =
  | 'SOLICITANTE'
  | 'APROVADOR_N1'
  | 'APROVADOR_N2'
  | 'DIRETOR_CFO'
  | 'AUDITOR'
  | 'ADMIN';

export interface CriarSolicitacaoDto {
  centroCustoId: string;
  valor: number;
  categoria: string;
  justificativa: string;
  fornecedor?: string;
  solicitanteNome?: string;
  solicitanteCargo?: string;
  fluxoId?: string;
  fluxoNome?: string;
}

export interface Solicitacao {
  id: string;
  tenantId: string;
  centroCustoId: string;
  solicitanteId: string;
  solicitanteNome?: string | null;
  solicitanteCargo?: string | null;
  valor: number;
  categoria: string;
  justificativa: string;
  fornecedor?: string | null;
  status: StatusSolicitacao;
  versao: number;
  alertaRisco: string | null;
  fluxoId?: string | null;
  fluxoNome?: string | null;
  etapaAtual?: number;
  totalEtapas?: number;
  aprovadorEsperadoPapel?: string | null;
  aprovadorEsperadoNivel?: ApprovalLevel | null;
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