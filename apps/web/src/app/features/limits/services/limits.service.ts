import { Injectable, computed, signal } from '@angular/core';
import { LimitRuleItem, RuleTemplateItem } from '../limits.models';

@Injectable({
  providedIn: 'root',
})
export class LimitsService {
  // Catálogo Central de Modelos de Regras (Padrões + Customizadas)
  readonly ruleTemplatesState = signal<RuleTemplateItem[]>([
    {
      type: 'CONDITION_VALUE',
      title: 'Teto de Valor (<, >, =)',
      description: 'Define limites monetários para disparar alçada ou escalonar aprovação.',
      icon: 'calculate',
      badge: 'Regra de Teto',
      badgeColor: '#644EF3',
      category: 'STANDARD',
      creationMethod: 'STANDARD',
      createdBy: 'Sistema Nativo',
      createdAt: 'Padrão do Sistema',
      usageCount: 14,
      defaultConfig: {
        operator: '<=',
        valueMin: 0,
        valueMax: 15000,
        currency: 'BRL',
      },
    },
    {
      type: 'APPROVER',
      title: 'Aprovador Único',
      description: 'Exige assinatura individual de um cargo ou hierarquia específica.',
      icon: 'person_check',
      badge: '1 Assinatura',
      badgeColor: '#10B981',
      category: 'STANDARD',
      creationMethod: 'STANDARD',
      createdBy: 'Sistema Nativo',
      createdAt: 'Padrão do Sistema',
      usageCount: 22,
      defaultConfig: {
        approverRole: 'GERENTE',
        quorum: 'UNICO',
        enforceSod: true,
      },
    },
    {
      type: 'APPROVER',
      title: 'Dupla Aprovação (2 Pessoas)',
      description: 'Exige duas assinaturas mútuas independentes para liberação.',
      icon: 'group',
      badge: 'Quórum Duplo',
      badgeColor: '#8B5CF6',
      category: 'STANDARD',
      creationMethod: 'STANDARD',
      createdBy: 'Sistema Nativo',
      createdAt: 'Padrão do Sistema',
      usageCount: 9,
      defaultConfig: {
        approverRole: 'DIRETOR',
        quorum: 'DUPLO',
        enforceSod: true,
      },
    },
    {
      type: 'SLA_TIMER',
      title: 'Tempo / SLA de Resposta',
      description: 'Estipula tempo máximo de espera antes de escalonar automaticamente.',
      icon: 'schedule',
      badge: 'SLA 48h',
      badgeColor: '#F59E0B',
      category: 'STANDARD',
      creationMethod: 'STANDARD',
      createdBy: 'Sistema Nativo',
      createdAt: 'Padrão do Sistema',
      usageCount: 18,
      defaultConfig: {
        slaHours: 48,
        escalateTo: 'SUPERIOR_DIRETO',
      },
    },
    {
      type: 'RISK_CHECK',
      title: 'Anti-Fracionamento & SoD',
      description: 'Bloqueio estrito de autoaprovação e checagem de janelas móveis de 30 dias.',
      icon: 'security',
      badge: 'Motor de Risco',
      badgeColor: '#EC4899',
      category: 'STANDARD',
      creationMethod: 'STANDARD',
      createdBy: 'Sistema Nativo',
      createdAt: 'Padrão do Sistema',
      usageCount: 26,
      defaultConfig: {
        riskWindowDays: 30,
        checkDuplicate: true,
        checkSplit: true,
      },
    },
    {
      type: 'TRIGGER',
      title: 'Gatilho de Centro de Custo',
      description: 'Aplica a alçada quando a despesa estiver associada a um departamento.',
      icon: 'account_tree',
      badge: 'Gatilho de Entrada',
      badgeColor: '#3B82F6',
      category: 'STANDARD',
      creationMethod: 'STANDARD',
      createdBy: 'Sistema Nativo',
      createdAt: 'Padrão do Sistema',
      usageCount: 30,
      defaultConfig: {
        costCenter: 'CC-104 - TI e Infra',
        category: 'Hardware & Equipamentos',
      },
    },
    // Regras Personalizadas (Exemplos criados pelos 3 caminhos)
    {
      type: 'APPROVER',
      title: 'Parecer Jurídico & Compliance > R$ 100k',
      description: 'Exige chancela prévia do corpo jurídico corporativo antes do envio ao CFO.',
      icon: 'gavel',
      badge: 'Chancela Jurídica',
      badgeColor: '#8B5CF6',
      category: 'CUSTOM',
      creationMethod: 'AI_PROMPT',
      createdBy: 'Gerado via Assistente IA',
      createdAt: 'Ontem às 16:40',
      usageCount: 3,
      defaultConfig: {
        approverRole: 'DIRETOR',
        quorum: 'UNICO',
        enforceSod: true,
      },
    },
    {
      type: 'CONDITION_VALUE',
      title: 'Teto Emergencial TI (Até R$ 50.000)',
      description: 'Despesas emergenciais de infraestrutura com aprovação imediata do CTO.',
      icon: 'bolt',
      badge: 'Emergência Cloud',
      badgeColor: '#EC4899',
      category: 'CUSTOM',
      creationMethod: 'DOCUMENT',
      createdBy: 'Importado de Politica_TI_2026.docx',
      createdAt: '18 Out 2026',
      usageCount: 5,
      defaultConfig: {
        operator: '<=',
        valueMin: 0,
        valueMax: 50000,
        currency: 'BRL',
      },
    },
    {
      type: 'SLA_TIMER',
      title: 'SLA Crítico Fast-Track (12 Horas)',
      description: 'Prazo limite reduzido para compras de matérias-primas críticas.',
      icon: 'timer',
      badge: 'Fast-Track 12h',
      badgeColor: '#F59E0B',
      category: 'CUSTOM',
      creationMethod: 'MANUAL',
      createdBy: 'Criado Manualmente por Admin',
      createdAt: '10 Out 2026',
      usageCount: 2,
      defaultConfig: {
        slaHours: 12,
        escalateTo: 'SUPERIOR_DIRETO',
      },
    },
  ]);

  addRuleTemplate(template: RuleTemplateItem): void {
    this.ruleTemplatesState.update((list) => [template, ...list]);
  }

  deleteRuleTemplate(title: string): void {
    this.ruleTemplatesState.update((list) => list.filter((t) => t.title !== title));
  }

  // Lista central de regras de alçada
  private readonly rulesState = signal<LimitRuleItem[]>([
    {
      id: 'ALC-7781',
      title: 'Alçada de Compras de TI & Hardware Cloud',
      department: 'Tecnologia & Infra',
      assignedTo: 'Atribuído a Diretoria TI',
      employmentType: 'Infraestrutura Crítica',
      locationOrCenter: 'CC-1042 · São Paulo Tech Hub',
      channelOrOrigin: 'Portal Alçadas',
      status: 'ACTIVE',
      statusLabel: 'Ativa',
      ceilingAmount: 85000,
      quorumLabel: '2 Aprovadores (Quórum Duplo)',
      slaHours: 24,
      sodEnforced: true,
      createdAt: '14 de Abril 2026',
      accentColor: '#644EF3',
      currentStepLabel: 'Parecer Gerencial',
      steps: [
        { name: 'Solicitação', status: 'completed', icon: 'description' },
        { name: 'Triagem SoD', status: 'completed', icon: 'security' },
        { name: 'Parecer Gerencial', status: 'active', icon: 'person' },
        { name: 'Aprovação CFO', status: 'pending', icon: 'payments' },
        { name: 'Homologação SHA-256', status: 'pending', icon: 'verified' },
      ],
    },
    {
      id: 'ALC-7782',
      title: 'Contratação de Terceiros e Consultoria Especializada',
      department: 'Gente & Gestão',
      assignedTo: 'Atribuído a Recursos Humanos & Jurídico',
      employmentType: 'Serviços Jurídicos / Consultivos',
      locationOrCenter: 'CC-2010 · Matriz Administrativa',
      channelOrOrigin: 'SaaS Externo',
      status: 'ACTIVE',
      statusLabel: 'Ativa',
      ceilingAmount: 150000,
      quorumLabel: '3 Aprovadores (Unânime)',
      slaHours: 48,
      sodEnforced: true,
      createdAt: '18 de Maio 2026',
      accentColor: '#8B5CF6',
      currentStepLabel: 'Aprovação Diretoria',
      steps: [
        { name: 'Solicitação', status: 'completed', icon: 'description' },
        { name: 'Triagem SoD', status: 'completed', icon: 'security' },
        { name: 'Parecer Jurídico', status: 'completed', icon: 'gavel' },
        { name: 'Aprovação Diretoria', status: 'active', icon: 'group' },
        { name: 'Homologação SHA-256', status: 'pending', icon: 'verified' },
      ],
    },
    {
      id: 'ALC-7783',
      title: 'Despesas de Viagem, Hospedagem e Representação',
      department: 'Controladoria & Finanças',
      assignedTo: 'Atribuído a Controladoria',
      employmentType: 'Despesas Operacionais',
      locationOrCenter: 'CC-3050 · Operações Regionais',
      channelOrOrigin: 'App Mobile',
      status: 'COMPLETED',
      statusLabel: 'Homologada',
      ceilingAmount: 12000,
      quorumLabel: '1 Assinatura (Gerente)',
      slaHours: 12,
      sodEnforced: true,
      createdAt: '22 de Junho 2026',
      accentColor: '#10B981',
      currentStepLabel: 'Concluído',
      steps: [
        { name: 'Solicitação', status: 'completed', icon: 'description' },
        { name: 'Triagem SoD', status: 'completed', icon: 'security' },
        { name: 'Recibos & Comprovantes', status: 'completed', icon: 'receipt_long' },
        { name: 'Aprovação Gerencial', status: 'completed', icon: 'person_check' },
        { name: 'Blockchain SHA-256', status: 'completed', icon: 'verified' },
      ],
    },
    {
      id: 'ALC-7784',
      title: 'Aquisição de Ativos e Maquinário Industrial',
      department: 'Engenharia & Produção',
      assignedTo: 'Atribuído a Diretoria Industrial',
      employmentType: 'Capex / Imobilizado',
      locationOrCenter: 'CC-4010 · Planta Fabril Sul',
      channelOrOrigin: 'ERP SAP',
      status: 'DRAFT',
      statusLabel: 'Rascunho',
      ceilingAmount: 350000,
      quorumLabel: 'Conselho de Administração',
      slaHours: 72,
      sodEnforced: true,
      createdAt: '05 de Julho 2026',
      accentColor: '#F59E0B',
      currentStepLabel: 'Em Definição',
      steps: [
        { name: 'Solicitação', status: 'completed', icon: 'description' },
        { name: 'Viabilidade Financeira', status: 'pending', icon: 'analytics' },
        { name: 'Parecer Técnico', status: 'pending', icon: 'engineering' },
        { name: 'Conselho Consultivo', status: 'pending', icon: 'account_balance' },
        { name: 'Homologação SHA-256', status: 'pending', icon: 'verified' },
      ],
    },
  ]);

  // Filtros ativos
  readonly activeTab = signal<string>('all');
  readonly searchQuery = signal<string>('');

  // Lista filtrada e reativa
  readonly filteredRules = computed(() => {
    
    const rules = this.rulesState();
    const tab = this.activeTab();
    const query = this.searchQuery().trim().toLowerCase();

    return rules.filter((rule) => {
      // Filtro por Tab
      if (tab === 'active' && rule.status !== 'ACTIVE') return false;
      if (tab === 'draft' && rule.status !== 'DRAFT') return false;
      if (tab === 'completed' && rule.status !== 'COMPLETED') return false;
      if (tab === 'ti' && !rule.department.toLowerCase().includes('tecnologia')) return false;

      // Filtro por Busca de Texto
      if (!query) return true;
      return (
        rule.title.toLowerCase().includes(query) ||
        rule.id.toLowerCase().includes(query) ||
        rule.department.toLowerCase().includes(query) ||
        rule.assignedTo.toLowerCase().includes(query)
      );
    });
  });

  // Métodos de consulta e alteração
  getRuleById(id: string): LimitRuleItem | undefined {
    return this.rulesState().find((r) => r.id === id);
  }

  deleteRule(id: string): void {
    this.rulesState.update((list) => list.filter((r) => r.id !== id));
  }

  duplicateRule(id: string): LimitRuleItem | undefined {
    const original = this.getRuleById(id);
    if (!original) return undefined;

    const newId = `ALC-${Math.floor(1000 + Math.random() * 9000)}`;
    const copy: LimitRuleItem = {
      ...original,
      id: newId,
      title: `${original.title} (Cópia)`,
      status: 'DRAFT',
      statusLabel: 'Rascunho',
      createdAt: 'Hoje',
      currentStepLabel: 'Em Revisão',
      steps: original.steps.map((s) => ({ ...s, status: 'pending' })),
    };

    this.rulesState.update((list) => [copy, ...list]);
    return copy;
  }

  createRule(partial: Partial<LimitRuleItem>): LimitRuleItem {
    const newId = `ALC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRule: LimitRuleItem = {
      id: newId,
      title: partial.title || 'Nova Regra de Alçada',
      department: partial.department || 'Geral',
      assignedTo: partial.assignedTo || 'Atribuído a Gestor',
      employmentType: partial.employmentType || 'Despesas Corporativas',
      locationOrCenter: partial.locationOrCenter || 'CC-Geral · Matriz',
      channelOrOrigin: 'Portal Web',
      status: 'DRAFT',
      statusLabel: 'Rascunho',
      ceilingAmount: partial.ceilingAmount || 20000,
      quorumLabel: partial.quorumLabel || '1 Aprovador',
      slaHours: partial.slaHours || 48,
      sodEnforced: true,
      createdAt: 'Hoje',
      accentColor: '#644EF3',
      currentStepLabel: 'Rascunho Inicial',
      steps: [
        { name: 'Solicitação', status: 'completed', icon: 'description' },
        { name: 'Triagem SoD', status: 'pending', icon: 'security' },
        { name: 'Alçada Gerencial', status: 'pending', icon: 'person_check' },
        { name: 'Homologação SHA-256', status: 'pending', icon: 'verified' },
      ],
    };

    this.rulesState.update((list) => [newRule, ...list]);
    return newRule;
  }
}
