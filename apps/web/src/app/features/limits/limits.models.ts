export type NodeType = 'TRIGGER' | 'CONDITION_VALUE' | 'APPROVER' | 'RISK_CHECK' | 'SLA_TIMER' | 'TERMINAL';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  icon: string;
  // Configurações específicas
  config: {
    // Para Condição de Valor
    operator?: '<' | '<=' | '>' | '>=' | 'ENTRE';
    valueMin?: number;
    valueMax?: number;
    currency?: string;
    // Para Aprovadores
    approverRole?: 'COORDENADOR' | 'GERENTE' | 'DIRETOR' | 'CFO' | 'CONSELHO';
    quorum?: 'UNICO' | 'DUPLO' | 'UNANIME';
    enforceSod?: boolean; // Segregação de Funções estrita
    // Para SLA
    slaHours?: number;
    escalateTo?: string;
    // Para Risco
    riskWindowDays?: number;
    checkDuplicate?: boolean;
    checkSplit?: boolean;
    // Para Triggers
    costCenter?: string;
    category?: string;
  };
}

export interface RuleTemplateItem {
  type: NodeType;
  title: string;
  description: string;
  icon: string;
  badge: string;
  badgeColor: string;
  defaultConfig: WorkflowNode['config'];
}
