import { StatusSolicitacao } from '@alcadas-core/models';

/** Status da tela = status da API (ADR-005). */
export type RequestStatus = StatusSolicitacao;

export type RequestPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type RequestCategory = string;

export type ApprovalStepStatus = 'CONCLUIDA' | 'EM_ANALISE' | 'PENDENTE' | 'REJEITADA' | 'AJUSTE';

export interface StepSignature {
  signatario: string;
  cargo: string;
  dataHora: string;
  hashSha256: string;
  assinaturaImg?: string;
}

export interface ApprovalStep {
  numero: number;
  nome: string;
  papel: string;
  responsavelNome?: string;
  status: ApprovalStepStatus;
  dataHora?: string;
  comentario?: string;
  assinatura?: StepSignature;
}

export interface WorkflowDestination {
  nome: string;
  totalEtapas: number;
  etapaAtualNumero?: number;
  etapaAtualNome: string;
  etapas: ApprovalStep[];
}

export interface RequestAttachment {
  id: string;
  nome: string;
  tamanho: string;
  tipo: string;
  icone: string;
}

/** Solicitação pronta para a tela, montada a partir do `SolicitacaoResponseDto` da API. */
export interface RequestItem {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  categoriaLabel: string;
  categoriaIcon: string;
  categoriaColor: string;
  centroCustoId: string;
  centroCustoNome: string;
  departamento: string;
  valor: number;
  fornecedor?: string;
  prioridade: RequestPriority;
  status: RequestStatus;
  statusLabel: string;
  statusIcon: string;
  /** Versão de concorrência otimista, obrigatória nas decisões (CA-05.1). */
  versao: number;
  dataCriacao: string;
  dataAtualizacao: string;
  solicitante: {
    id: string;
    nome: string;
    cargo: string;
  };
  anexos: RequestAttachment[];
  fluxoId?: string | null;
  fluxoNome?: string | null;
  etapaAtual?: number;
  totalEtapas?: number;
  aprovadorEsperadoPapel?: string | null;
  aprovadorEsperadoNivel?: string | null;
  fluxoDestinado: WorkflowDestination;
}

export interface RequestStats {
  total: number;
  totalPercentCompleted: number;
  pendentes: number;
  pendentesValorTotal: number;
  aprovadas: number;
  taxaAprovacao: number;
  ajustes: number;
  rejeitadas: number;
}

export interface CostCenterOption {
  id: string;
  code: string;
  nome: string;
  departamento?: string;
}

export interface CategoryOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  limiteBase: number;
}

/** Corpo de `POST /api/solicitacoes` (OpenAPI v0.2 — CriarSolicitacaoDto). */
export interface CreateRequestDto {
  centroCustoId: string;
  categoria: string;
  valor: number;
  justificativa: string;
  fornecedor?: string;
  fluxoId?: string;
  fluxoNome?: string;
  solicitanteNome?: string;
  solicitanteCargo?: string;
}

/** Dados estendidos da página de criação local/API. */
export interface CreateRequestFormPayload {
  titulo?: string;
  centroCustoId: string;
  categoria: string;
  valor: number;
  prioridade?: RequestPriority;
  justificativa: string;
  fornecedor?: string;
  fluxoId?: string;
  fluxoNome?: string;
  anexos?: Array<{ nome: string; tamanho: string; tipo: string }>;
}

export type DecisionAction = 'aprovar' | 'rejeitar' | 'ajuste';

/** Estado de carregamento de uma tela ou bloco (RNF08). */
export type LoadState = 'carregando' | 'pronto' | 'erro';
