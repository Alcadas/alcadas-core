import {
  FaixaRegraAlcada,
  ModeloRegraAlcada,
  QuorumRegra,
  rotuloPapelAprovador,
} from '@alcadas-core/models';
import { LimitRuleItem, LimitStep, WorkflowNode } from '../limits.models';

export interface BuildWorkflowNodesOptions {
  ruleTitle?: string;
  costCenter?: string;
  category?: string;
  quorum?: QuorumRegra | string;
  slaHours?: number;
  initialIsNew?: boolean;
}

/** Formata número em moeda brasileira BRL sem decimal quando inteiro ou com 2 decimais. */
export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Constrói determinística e visualmente o pipeline sequencial de nós do fluxo
 * a partir das faixas de alçada definidas em um modelo pré-definido (#69).
 *
 * Estrutura da esteira:
 * 1. TRIGGER: Início / Gatilho de entrada com centro de custo e categoria
 * 2. RISK_CHECK: Triagem de Risco, segregação de funções (SoD) e anti-fracionamento
 * 3. Para cada faixa:
 *    - CONDITION_VALUE: Limite monetário (ex.: <= R$ 500, <= R$ 2.000, ou > R$ 2.000)
 *    - APPROVER: Instância com competência (ex.: Coordenação, Gerência, Diretoria, etc.),
 *      quórum configurado e exigência de parecer técnico se marcada.
 * 4. SLA_TIMER: Prazo máximo de resposta com escalonamento automático
 * 5. TERMINAL: Homologação e gravação do elo criptográfico SHA-256
 */
export function buildWorkflowNodesFromFaixas(
  faixas: readonly FaixaRegraAlcada[] | undefined,
  options?: BuildWorkflowNodesOptions,
): WorkflowNode[] {
  const safeFaixas = Array.isArray(faixas) && faixas.length > 0 ? faixas : [];
  const costCenter = options?.costCenter?.trim() || 'CC-Geral · Matriz';
  const category = options?.category?.trim() || 'Despesas Corporativas';
  const quorum = options?.quorum || 'Aprovador Único';
  const slaHours = options?.slaHours && options.slaHours > 0 ? options.slaHours : 24;
  const isNew = options?.initialIsNew ?? false;

  const quorumType: 'UNICO' | 'DUPLO' | 'UNANIME' =
    quorum === 'Quórum Duplo' || quorum === 'DUPLO'
      ? 'DUPLO'
      : quorum === 'Quórum Unânime' || quorum === 'UNANIME'
        ? 'UNANIME'
        : 'UNICO';

  const quorumLabel =
    quorumType === 'DUPLO' ? 'Quórum Duplo' : quorumType === 'UNANIME' ? 'Quórum Unânime' : '1 Assinatura';

  const nodes: WorkflowNode[] = [];

  // 1. TRIGGER
  nodes.push({
    id: 'node-trigger',
    type: 'TRIGGER',
    title: `Início: ${options?.ruleTitle || 'Solicitação de Alçada'}`,
    subtitle: `Gatilho disparado para o centro de custo ${costCenter}`,
    tag: `Origem: ${category}`,
    tagColor: '#3B82F6',
    icon: 'play_arrow',
    isNew,
    config: {
      costCenter,
      category,
    },
  });

  // 2. RISK_CHECK
  nodes.push({
    id: 'node-risk',
    type: 'RISK_CHECK',
    title: 'Triagem de Risco & Segregação (SoD)',
    subtitle: 'Bloqueio estrito de autorrequisição e verificação anti-fracionamento em janela de 30 dias',
    tag: 'Motor de Risco',
    tagColor: '#EC4899',
    icon: 'security',
    isNew,
    config: {
      riskWindowDays: 30,
      checkDuplicate: true,
      checkSplit: true,
    },
  });

  // 3. FAIXAS -> CONDITION_VALUE + APPROVER
  safeFaixas.forEach((faixa, index) => {
    const idx = index + 1;
    const maxVal = typeof faixa.valorMaximo === 'number' && Number.isFinite(faixa.valorMaximo) ? faixa.valorMaximo : null;
    const hasMax = maxVal !== null;
    const minVal = typeof faixa.valorMinimo === 'number' ? faixa.valorMinimo : 0;
    const papel = faixa.papelAprovador || 'GERENTE';
    const papelLabel = rotuloPapelAprovador(papel);
    const techApproval = !!faixa.aprovacaoTecnica;

    const conditionTitle = hasMax
      ? `Teto Faixa ${idx} (${formatCurrencyBRL(maxVal)})`
      : `Alçada Faixa ${idx} (Acima de ${formatCurrencyBRL(minVal)})`;

    const conditionSubtitle = hasMax
      ? `Solicitações entre ${formatCurrencyBRL(minVal)} e ${formatCurrencyBRL(maxVal)}`
      : `Solicitações superiores a ${formatCurrencyBRL(minVal)} sem limite máximo`;

    const conditionTag = hasMax
      ? `Valor <= ${formatCurrencyBRL(maxVal)}`
      : `Valor > ${formatCurrencyBRL(minVal)}`;

    // Condição de Valor
    nodes.push({
      id: `node-cond-${idx}`,
      type: 'CONDITION_VALUE',
      title: conditionTitle,
      subtitle: conditionSubtitle,
      tag: conditionTag,
      tagColor: '#644EF3',
      icon: 'calculate',
      isNew,
      config: {
        operator: hasMax ? '<=' : '>',
        valueMin: minVal,
        valueMax: hasMax ? maxVal : undefined,
        currency: 'BRL',
      },
    });

    // Aprovador
    const approverTitle = techApproval
      ? `Aprovação: ${papelLabel} (+ Parecer Técnico de TI)`
      : `Aprovação: ${papelLabel}`;

    const approverSubtitle = techApproval
      ? `Exige chancela técnica prévia de TI e assinatura do ${papelLabel}`
      : `Deliberação obrigatória por ${papelLabel} com assinatura digital e segregação SoD`;

    const approverTag = techApproval
      ? `${quorumLabel} · ${papelLabel} + TI`
      : `${quorumLabel} · ${papelLabel}`;

    nodes.push({
      id: `node-app-${idx}`,
      type: 'APPROVER',
      title: approverTitle,
      subtitle: approverSubtitle,
      tag: approverTag,
      tagColor: '#10B981',
      icon: techApproval ? 'verified_user' : quorumType === 'DUPLO' ? 'group' : 'person_check',
      isNew,
      config: {
        approverRole: papel as WorkflowNode['config']['approverRole'],
        quorum: quorumType,
        enforceSod: true,
      },
    });
  });

  // 4. SLA_TIMER
  nodes.push({
    id: 'node-sla',
    type: 'SLA_TIMER',
    title: `SLA de Decisão: ${slaHours} Horas`,
    subtitle: 'Caso expire o prazo limite, escalona automaticamente para o superior imediato',
    tag: `Tempo Máx: ${slaHours}h`,
    tagColor: '#F59E0B',
    icon: 'schedule',
    isNew,
    config: {
      slaHours,
      escalateTo: 'SUPERIOR_DIRETO',
    },
  });

  // 5. TERMINAL
  nodes.push({
    id: 'node-terminal',
    type: 'TERMINAL',
    title: 'Homologação & Trilha SHA-256',
    subtitle: 'Gravação determinística do elo criptográfico e liberação da despesa',
    tag: 'Concluído',
    tagColor: '#059669',
    icon: 'verified',
    isNew,
    config: {},
  });

  return nodes;
}

/** Constrói os nós da esteira diretamente a partir de um ModeloRegraAlcada. */
export function buildWorkflowNodesFromModelo(
  modelo: ModeloRegraAlcada,
  options?: Partial<BuildWorkflowNodesOptions>,
): WorkflowNode[] {
  return buildWorkflowNodesFromFaixas(options?.faixas ?? modelo.faixas, {
    ruleTitle: options?.ruleTitle || modelo.nome,
    costCenter: options?.costCenter || modelo.centroCustoSugerido,
    category: options?.category || modelo.categoria,
    quorum: options?.quorum || modelo.quorum,
    slaHours: options?.slaHours || modelo.slaHoras,
    initialIsNew: options?.initialIsNew,
  });
}

/** Calcula o maior teto finito entre os nós de condição da esteira. */
export function calculateCeilingFromNodes(nodes: readonly WorkflowNode[]): number {
  const maximos = nodes
    .filter((n) => n.type === 'CONDITION_VALUE' && typeof n.config.valueMax === 'number' && Number.isFinite(n.config.valueMax))
    .map((n) => n.config.valueMax as number);
  return maximos.length > 0 ? Math.max(...maximos) : 0;
}

/** Extrai os passos do stepper resumido (exibido nos cards da listagem) a partir dos nós do pipeline. */
export function extractStepsFromNodes(nodes: readonly WorkflowNode[]): LimitStep[] {
  const approverNodes = nodes.filter((n) => n.type === 'APPROVER');
  const roleNames = approverNodes.map((a) => a.title.replace('Aprovação: ', '')).join(' / ');

  return [
    { name: 'Solicitação', status: 'completed', icon: 'description' },
    { name: 'Triagem SoD', status: 'completed', icon: 'security' },
    { name: roleNames ? `Alçada ${roleNames}` : 'Alçadas Hierárquicas', status: 'pending', icon: 'person_check' },
    { name: 'Homologação SHA-256', status: 'pending', icon: 'verified' },
  ];
}

/** Cria um objeto LimitRuleItem completo a partir de um modelo pré-definido e opções. */
export function mapModeloToLimitRule(
  modelo: ModeloRegraAlcada,
  overrides?: {
    id?: string;
    nome?: string;
    centroCusto?: string;
    quorum?: QuorumRegra;
    slaHoras?: number;
    faixas?: FaixaRegraAlcada[];
    department?: string;
    company?: string;
    category?: string;
    status?: LimitRuleItem['status'];
  },
): LimitRuleItem {
  const newId = overrides?.id || `ALC-${Math.floor(1000 + Math.random() * 9000)}`;
  const title = overrides?.nome || modelo.nome;
  const costCenter = overrides?.centroCusto || modelo.centroCustoSugerido;
  const quorum = overrides?.quorum || modelo.quorum;
  const slaHours = overrides?.slaHoras ?? modelo.slaHoras;
  const faixas = overrides?.faixas ? overrides.faixas.map((f) => ({ ...f })) : modelo.faixas.map((f) => ({ ...f }));
  const category = overrides?.category || modelo.categoria;
  const department =
    overrides?.department ||
    (costCenter.includes('·') ? costCenter.split('·')[1].trim() : costCenter) ||
    'Operações';

  const nodes = buildWorkflowNodesFromFaixas(faixas, {
    ruleTitle: title,
    costCenter,
    category,
    quorum,
    slaHours,
  });

  const ceiling = calculateCeilingFromNodes(nodes);
  const status = overrides?.status || 'ACTIVE';

  return {
    id: newId,
    title,
    department,
    assignedTo: `Gestores de ${department}`,
    employmentType: 'Despesas Corporativas',
    locationOrCenter: costCenter,
    channelOrOrigin: 'Portal Web',
    status,
    statusLabel: status === 'ACTIVE' ? 'Ativo' : status === 'COMPLETED' ? 'Homologado' : 'Rascunho',
    ceilingAmount: ceiling,
    quorumLabel: quorum,
    slaHours,
    sodEnforced: true,
    createdAt: 'Hoje',
    accentColor: '#644EF3',
    steps: extractStepsFromNodes(nodes),
    currentStepLabel: 'Esteira Configurada',
    modeloId: modelo.id,
    faixas,
    nodes,
    company: overrides?.company || 'Matriz Corporativa SP',
    category,
  };
}
