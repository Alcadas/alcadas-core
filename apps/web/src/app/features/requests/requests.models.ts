export type RequestStatus =
  | 'PENDENTE'
  | 'APROVADA'
  | 'REJEITADA'
  | 'AJUSTE_SOLICITADO'
  | 'CANCELADA';

export type RequestPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type RequestCategory =
  | 'SERVICOS_TERCEIROS'
  | 'EQUIPAMENTOS_TI'
  | 'MATERIAIS_ESCRITORIO'
  | 'VIAGENS_HOSPEDAGEM'
  | 'MANUTENCAO_PREDIAL'
  | 'MARKETING_EVENTOS'
  | 'CONSULTORIA';

export type ApprovalStepStatus =
  | 'CONCLUIDA'
  | 'EM_ANALISE'
  | 'PENDENTE'
  | 'REJEITADA'
  | 'AJUSTE';

export interface ApprovalStep {
  numero: number;
  nome: string;
  papel: string;
  responsavelNome?: string;
  status: ApprovalStepStatus;
  dataHora?: string;
  comentario?: string;
}

export interface WorkflowDestination {
  id: string;
  nome: string;
  totalEtapas: number;
  etapaAtualNumero: number;
  etapaAtualNome: string;
  etapas: ApprovalStep[];
}

export interface RequestAttachment {
  id: string;
  nome: string;
  tamanho: string;
  tipo: string;
  icone: string;
  url?: string;
}

export interface RequestItem {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: RequestCategory;
  categoriaLabel: string;
  categoriaIcon: string;
  categoriaColor: string;
  centroCustoId: string;
  centroCustoNome: string;
  departamento: string;
  valor: number;
  prioridade: RequestPriority;
  status: RequestStatus;
  statusLabel: string;
  statusIcon: string;
  dataCriacao: string;
  dataAtualizacao: string;
  solicitante: {
    id: string;
    nome: string;
    cargo: string;
    email: string;
    avatar?: string;
  };
  fluxoDestinado: WorkflowDestination;
  anexos: RequestAttachment[];
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

export interface RequestFilter {
  tab: 'todas' | 'pendentes' | 'aprovadas' | 'ajustes' | 'rejeitadas';
  search: string;
  categoria: string;
  centroCustoId: string;
  sortBy: 'recentes' | 'maior_valor' | 'menor_valor' | 'prioridade';
}

export interface CreateRequestDto {
  titulo: string;
  categoria: RequestCategory;
  centroCustoId: string;
  valor: number;
  prioridade: RequestPriority;
  justificativa: string;
  anexos?: Array<{ nome: string; tamanho: string; tipo: string }>;
}
