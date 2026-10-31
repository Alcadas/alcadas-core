import { Injectable, computed, signal } from '@angular/core';
import { LimitRuleItem } from '../limits.models';

@Injectable({
  providedIn: 'root',
})
export class LimitsService {
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
