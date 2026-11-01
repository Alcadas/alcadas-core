import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { LimitsService } from '../../services/limits.service';

export type RuleCategoryType = 'CAPEX' | 'OPERATIONAL' | 'GOVERNANCE' | 'CONTRACTS' | 'AUDIT';
export type CreationMethodType = 'prompt' | 'manual' | 'document';
export type CatalogSubTab = 'rules' | 'templates' | 'editor';

export interface RuleListItem {
  id: string;
  name: string;
  type: RuleCategoryType;
  typeLabel: string;
  typeIcon: string;
  typeVariant: 'live' | 'event' | 'tournament' | 'link' | 'neutral';
  propertyScope: string;
  isActive: boolean;
  creationMethod: CreationMethodType;
  ceilingAmount?: number;
  approverRole?: string;
  quorum?: string;
  slaHours?: number;
  description?: string;
}

@Component({
  selector: 'app-rules-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './rules-catalog.component.html',
  styleUrl: './rules-catalog.component.scss',
})
export class RulesCatalogComponent {
  private readonly router = inject(Router);
  protected readonly limitsService = inject(LimitsService);

  // Sub-abas principais: Lista de Regras (Imagem 2), Modelos Predefinidos, Editor da Regra Selecionada
  readonly activeCatalogTab = signal<CatalogSubTab>('rules');

  // Filtros da barra de ferramentas (Imagem 2)
  readonly seeOnlyActive = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly selectedScopeFilter = signal<string>('TODOS');

  // Lista de Regras Cadastradas (Estruturada conforme o design da Imagem 2)
  readonly rulesList = signal<RuleListItem[]>([
    {
      id: 'rule-01',
      name: 'Alçada de Capex & TI e Infraestrutura Cloud',
      type: 'CAPEX',
      typeLabel: 'Capex & TI',
      typeIcon: 'sensors',
      typeVariant: 'live',
      propertyScope: 'TI & Engenharia',
      isActive: true,
      creationMethod: 'prompt',
      ceilingAmount: 85000,
      approverRole: 'Diretor de Tecnologia & CTO',
      quorum: 'Quórum Duplo',
      slaHours: 24,
      description: 'Compras de servidores, licenças cloud e hardware corporativo acima de R$ 50.000.',
    },
    {
      id: 'rule-02',
      name: 'Compras Operacionais & Suprimentos Contínuos',
      type: 'OPERATIONAL',
      typeLabel: 'Operacional',
      typeIcon: 'calendar_today',
      typeVariant: 'event',
      propertyScope: 'Todos os Departamentos',
      isActive: true,
      creationMethod: 'manual',
      ceilingAmount: 15000,
      approverRole: 'Gerente Administrativo',
      quorum: 'Aprovador Único',
      slaHours: 12,
      description: 'Aquisição de materiais de consumo, expediente e insumos operacionais.',
    },
    {
      id: 'rule-03',
      name: 'Contratação de Consultoria Especializada & Jurídico',
      type: 'GOVERNANCE',
      typeLabel: 'Governança & Jurídico',
      typeIcon: 'workspace_premium',
      typeVariant: 'tournament',
      propertyScope: 'Financeiro & Jurídico',
      isActive: true,
      creationMethod: 'prompt',
      ceilingAmount: 150000,
      approverRole: 'Diretoria Executiva & CFO',
      quorum: 'Quórum Unânime',
      slaHours: 48,
      description: 'Auditorias externas, assessorias jurídicas e pareceres regulatórios da ANS/CVM.',
    },
    {
      id: 'rule-04',
      name: 'Despesas de Viagens, Hospedagem e Representação',
      type: 'CONTRACTS',
      typeLabel: 'Contratos & Viagens',
      typeIcon: 'link',
      typeVariant: 'link',
      propertyScope: 'Todos os Departamentos',
      isActive: false,
      creationMethod: 'document',
      ceilingAmount: 12000,
      approverRole: 'Gerente da Unidade',
      quorum: 'Aprovador Único',
      slaHours: 24,
      description: 'Passagens aéreas, estadias e deslocamentos corporativos para congressos.',
    },
    {
      id: 'rule-05',
      name: 'Manutenção Predial & Calibração Hospitalar',
      type: 'OPERATIONAL',
      typeLabel: 'Operacional',
      typeIcon: 'calendar_today',
      typeVariant: 'event',
      propertyScope: 'Operações Médicas',
      isActive: true,
      creationMethod: 'manual',
      ceilingAmount: 25000,
      approverRole: 'Supervisor de Operações',
      quorum: 'Aprovador Único',
      slaHours: 8,
      description: 'Calibração semestral de tomografia, raio-X e reparos estruturais em clínicas.',
    },
    {
      id: 'rule-06',
      name: 'Verba Emergencial de TI & Resposta a Incidentes',
      type: 'CAPEX',
      typeLabel: 'Capex & TI',
      typeIcon: 'sensors',
      typeVariant: 'live',
      propertyScope: 'TI & Engenharia',
      isActive: true,
      creationMethod: 'prompt',
      ceilingAmount: 50000,
      approverRole: 'Head de Infraestrutura',
      quorum: 'Aprovador Único',
      slaHours: 4,
      description: 'Fast-track para restauração de backups e contenção de incidentes de segurança.',
    },
    {
      id: 'rule-07',
      name: 'Aquisição de Imobilizado & Maquinário Fabril',
      type: 'AUDIT',
      typeLabel: 'Auditoria & Risco',
      typeIcon: 'article',
      typeVariant: 'neutral',
      propertyScope: 'Engenharia & Produção',
      isActive: false,
      creationMethod: 'document',
      ceilingAmount: 350000,
      approverRole: 'Conselho de Administração',
      quorum: 'Quórum Qualificado',
      slaHours: 72,
      description: 'Aquisição de máquinas pesadas e investimentos de capital (Capex fabril).',
    },
  ]);

  // Lista Filtrada reativa para a tabela da Imagem 2
  readonly filteredRulesList = computed(() => {
    let list = this.rulesList();
    const onlyActive = this.seeOnlyActive();
    const query = this.searchQuery().trim().toLowerCase();
    const scope = this.selectedScopeFilter();

    if (onlyActive) {
      list = list.filter((r) => r.isActive);
    }

    if (scope !== 'TODOS') {
      list = list.filter((r) => r.propertyScope.includes(scope));
    }

    if (query) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.typeLabel.toLowerCase().includes(query) ||
          r.propertyScope.toLowerCase().includes(query)
      );
    }

    return list;
  });

  readonly activeRulesCount = computed(() => this.rulesList().filter((r) => r.isActive).length);
  readonly totalRulesCount = computed(() => this.rulesList().length);

  // =========================================================================
  // ESTADO DO MODAL DE CRIAÇÃO (IMAGEM 1 DE REFERÊNCIA)
  // =========================================================================
  readonly isCreateModalOpen = signal<boolean>(false);
  readonly modalScope = signal<'global' | 'department'>('global');
  readonly modalCreationMethod = signal<CreationMethodType>('prompt');
  readonly modalRuleName = signal<string>('');
  readonly modalActivateImmediately = signal<boolean>(true);
  readonly modalErrorMessage = signal<string | null>(null);

  // =========================================================================
  // ESTADO DO EDITOR DA REGRA (ABA DEPOIS QUE CRIA OU EDITA)
  // =========================================================================
  readonly editingRule = signal<RuleListItem | null>(null);
  readonly editingMode = signal<CreationMethodType>('prompt');

  // Estado do Editor: Chat / IA (Prompt)
  readonly chatPrompt = signal<string>('');
  readonly isAiThinking = signal<boolean>(false);
  readonly chatMessages = signal<
    Array<{ sender: 'user' | 'assistant'; text: string; generatedRule?: Partial<RuleListItem> }>
  >([
    {
      sender: 'assistant',
      text: 'Olá! Sou o assistente de governança por IA. Descreva a regra em linguagem natural (ex: "Compras de TI acima de R$ 30.000 precisam de aprovação do Diretor de TI em até 24h") e eu estruturo as alçadas automaticamente.',
    },
  ]);

  // Estado do Editor: Manual
  readonly manualType = signal<RuleCategoryType>('OPERATIONAL');
  readonly manualRole = signal<string>('GERENTE');
  readonly manualAmount = signal<number>(25000);
  readonly manualQuorum = signal<string>('Aprovador Único');
  readonly manualSlaHours = signal<number>(24);
  readonly manualScope = signal<string>('Todos os Departamentos');
  readonly manualDescription = signal<string>('');

  // Estado do Editor: Documento
  readonly isDocUploading = signal<boolean>(false);
  readonly uploadedDocName = signal<string | null>(null);
  readonly extractedClauses = signal<
    Array<{ clause: string; ceiling: number; approver: string; sla: number }>
  >([]);

  // Toast de feedback
  readonly toast = signal<{ title: string; message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // =========================================================================
  // AÇÕES DO MODAL (IMAGEM 1)
  // =========================================================================
  openCreateModal(): void {
    this.modalRuleName.set('');
    this.modalCreationMethod.set('prompt');
    this.modalScope.set('global');
    this.modalActivateImmediately.set(true);
    this.modalErrorMessage.set(null);
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  selectModalMethod(method: CreationMethodType): void {
    this.modalCreationMethod.set(method);
  }

  selectModalScope(scope: 'global' | 'department'): void {
    this.modalScope.set(scope);
  }

  confirmCreateRule(): void {
    const name = this.modalRuleName().trim();
    if (!name) {
      this.modalErrorMessage.set('Por favor, informe o nome para esta regra.');
      return;
    }

    const method = this.modalCreationMethod();
    const scopeLabel =
      this.modalScope() === 'global' ? 'Todos os Departamentos' : 'Departamento Específico';

    // Cria a nova regra na lista
    const newRule: RuleListItem = {
      id: `rule-${Date.now()}`,
      name,
      type: method === 'prompt' ? 'GOVERNANCE' : method === 'document' ? 'AUDIT' : 'OPERATIONAL',
      typeLabel: method === 'prompt' ? 'Governança IA' : method === 'document' ? 'Documento' : 'Operacional',
      typeIcon: method === 'prompt' ? 'auto_awesome' : method === 'document' ? 'article' : 'tune',
      typeVariant: method === 'prompt' ? 'tournament' : method === 'document' ? 'neutral' : 'event',
      propertyScope: scopeLabel,
      isActive: this.modalActivateImmediately(),
      creationMethod: method,
      ceilingAmount: 50000,
      approverRole: 'Gerência / Diretoria',
      quorum: 'Quórum Duplo',
      slaHours: 24,
      description: `Regra criada via método ${method.toUpperCase()} com governança integrada.`,
    };

    this.rulesList.update((list) => [newRule, ...list]);
    this.closeCreateModal();

    // Abre a aba de edição da regra conforme a opção selecionada!
    this.openEditorForRule(newRule);
    this.triggerToast(
      'Regra Criada com Sucesso',
      `A regra "${name}" foi criada. Configure agora os parâmetros na aba de edição.`,
      'success'
    );
  }

  // =========================================================================
  // AÇÕES DE EDIÇÃO & ABAS
  // =========================================================================
  openEditorForRule(rule: RuleListItem): void {
    this.editingRule.set(rule);
    this.editingMode.set(rule.creationMethod);

    // Carrega valores no modo manual
    this.manualType.set(rule.type);
    this.manualAmount.set(rule.ceilingAmount || 30000);
    this.manualRole.set(rule.approverRole || 'GERENTE');
    this.manualQuorum.set(rule.quorum || 'Aprovador Único');
    this.manualSlaHours.set(rule.slaHours || 24);
    this.manualScope.set(rule.propertyScope);
    this.manualDescription.set(rule.description || '');

    // Carrega mensagens no modo chat se estiver vazio
    if (this.chatMessages().length <= 1) {
      this.chatMessages.set([
        {
          sender: 'assistant',
          text: `Você está editando a regra "${rule.name}". Como deseja ajustar as faixas de valor, aprovadores e prazos de resposta?`,
        },
      ]);
    }

    this.activeCatalogTab.set('editor');
  }

  closeEditor(): void {
    this.activeCatalogTab.set('rules');
    this.editingRule.set(null);
  }

  saveEditorChanges(): void {
    const current = this.editingRule();
    if (!current) return;

    const mode = this.editingMode();
    let updatedCeiling = current.ceilingAmount;
    let updatedRole = current.approverRole;
    let updatedDesc = current.description;

    if (mode === 'manual') {
      updatedCeiling = this.manualAmount();
      updatedRole = this.manualRole();
      updatedDesc = this.manualDescription();
    }

    this.rulesList.update((list) =>
      list.map((r) =>
        r.id === current.id
          ? {
              ...r,
              ceilingAmount: updatedCeiling,
              approverRole: updatedRole,
              description: updatedDesc,
            }
          : r
      )
    );

    this.triggerToast(
      'Alterações Salvas',
      `A regra "${current.name}" foi atualizada com sucesso no catálogo corporativo.`,
      'success'
    );
    this.closeEditor();
  }

  // Toggle do switch na lista da Imagem 2
  toggleRuleActive(ruleId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.rulesList.update((list) =>
      list.map((r) => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r))
    );
    const rule = this.rulesList().find((r) => r.id === ruleId);
    if (rule) {
      this.triggerToast(
        rule.isActive ? 'Regra Ativada' : 'Regra Desativada',
        `A regra "${rule.name}" está agora ${rule.isActive ? 'ativa em produção' : 'inativa'}.`,
        'info'
      );
    }
  }

  // Ações do chat por IA
  sendChatMessage(suggestion?: string): void {
    const text = (suggestion || this.chatPrompt()).trim();
    if (!text) return;

    this.chatMessages.update((msgs) => [...msgs, { sender: 'user', text }]);
    this.chatPrompt.set('');
    this.isAiThinking.set(true);

    setTimeout(() => {
      this.isAiThinking.set(false);
      this.chatMessages.update((msgs) => [
        ...msgs,
        {
          sender: 'assistant',
          text: `Analisei sua instrução de governança corporativa. Estruturei os seguintes parâmetros para a regra:
• Teto de Valor: R$ 45.000,00
• Quórum: Dupla Aprovação (Gerente da Unidade + Diretor)
• SLA Máximo: 24 Horas
• Regra SoD (Segregação de Funções): Ativada`,
          generatedRule: {
            ceilingAmount: 45000,
            approverRole: 'Gerente da Unidade + Diretor',
            quorum: 'Quórum Duplo',
            slaHours: 24,
          },
        },
      ]);
    }, 900);
  }

  // Upload simulado de documento
  simulateDocUpload(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      this.uploadedDocName.set(file.name);
      this.isDocProcessing();
    }
  }

  isDocProcessing(): void {
    this.isDocUploading.set(true);
    setTimeout(() => {
      this.isDocUploading.set(false);
      this.extractedClauses.set([
        {
          clause: 'Cláusula 4.1: Despesas de TI acima de R$ 20.000 exigem chancela do CTO.',
          ceiling: 20000,
          approver: 'CTO / Diretor de Tecnologia',
          sla: 12,
        },
        {
          clause: 'Cláusula 5.2: Despesas entre R$ 20.000 e R$ 80.000 requerem parecer do CFO.',
          ceiling: 80000,
          approver: 'CFO / Controladoria',
          sla: 24,
        },
      ]);
    }, 800);
  }

  // Barra flutuante de salvar/publicar (Imagem 2)
  revertChanges(): void {
    this.triggerToast('Alterações Descartadas', 'Os estados originais das regras foram restaurados.', 'info');
  }

  saveAsDraft(): void {
    this.triggerToast('Rascunho Salvo', 'As regras foram salvas como rascunho de trabalho.', 'info');
  }

  publishRules(): void {
    this.triggerToast(
      'Políticas Publicadas',
      'Todas as regras ativas foram sincronizadas com o motor de esteiras de alçadas.',
      'success'
    );
  }

  // Navegação
  goBack(): void {
    this.router.navigate(['/alcadas/minhas-alcadas']);
  }

  goToEditor(): void {
    this.router.navigate(['/alcadas/novo']);
  }

  private triggerToast(
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning'
  ): void {
    this.toast.set({ title, message, type });
    setTimeout(() => {
      this.toast.set(null);
    }, 4500);
  }
}
