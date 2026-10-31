import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { LimitsService } from '../../services/limits.service';
import { NodeType, RuleTemplateItem } from '../../limits.models';

export type RuleCreationMode = 'none' | 'ai' | 'document' | 'manual';

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

  // Modo de criação ativo: 'none' (só visualização) ou 'ai' | 'document' | 'manual'
  readonly activeMode = signal<RuleCreationMode>('ai');

  // Estado da gaveta inferior que se estica para cima para ver os modelos disponíveis
  readonly isDrawerExpanded = signal(false);

  // Busca rápida nos modelos
  readonly searchQuery = signal('');

  // Filtro de listagem: 'all' | 'standard' | 'custom'
  readonly selectedFilter = signal<'all' | 'standard' | 'custom'>('all');

  // Mensagem de sucesso
  readonly successMessage = signal<string | null>(null);

  // Estado do Assistente IA
  readonly aiPrompt = signal('');
  readonly isAiGenerating = signal(false);
  readonly aiGeneratedRule = signal<RuleTemplateItem | null>(null);
  readonly aiChatHistory = signal<Array<{ sender: 'user' | 'assistant'; text: string; rulePreview?: RuleTemplateItem }>>([]);

  // Sugestões prontas de prompt (Imagem 0)
  readonly promptSuggestions = [
    'Despesas operacionais acima de R$ 50.000 exigem dupla aprovação de Diretores',
    'Compras emergenciais de TI com aprovação única do Gerente de Infra e SLA de 12h',
    'Contratação de consultoria externa requer parecer jurídico e quórum do CFO',
  ];

  // Estado da Importação de Documento
  readonly isDocProcessing = signal(false);
  readonly uploadedFileName = signal<string | null>(null);
  readonly extractedDocRules = signal<RuleTemplateItem[]>([]);

  // Estado do Criador Manual
  readonly manualTitle = signal('Aprovação Fast-Track Operacional');
  readonly manualType = signal<NodeType>('APPROVER');
  readonly manualDesc = signal('Exige assinatura digital de cargo específico para liberação ágil.');
  readonly manualRole = signal<'COORDENADOR' | 'GERENTE' | 'DIRETOR' | 'CFO' | 'CONSELHO'>('GERENTE');
  readonly manualQuorum = signal<'UNICO' | 'DUPLO' | 'UNANIME'>('UNICO');
  readonly manualOperator = signal<'<=' | '<' | '>=' | '>' | 'ENTRE'>('<=');
  readonly manualAmount = signal(35000);
  readonly manualSlaHours = signal(24);
  readonly manualSod = signal(true);

  // Lista filtrada de regras com busca inteligente
  readonly filteredRules = computed(() => {
    const filter = this.selectedFilter();
    const query = this.searchQuery().trim().toLowerCase();
    let rules = this.limitsService.ruleTemplatesState();

    if (filter === 'standard') {
      rules = rules.filter((r) => r.category === 'STANDARD');
    } else if (filter === 'custom') {
      rules = rules.filter((r) => r.category === 'CUSTOM');
    }

    if (query) {
      rules = rules.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.badge.toLowerCase().includes(query)
      );
    }

    return rules;
  });

  // Estatísticas
  readonly standardCount = computed(
    () => this.limitsService.ruleTemplatesState().filter((r) => r.category === 'STANDARD').length
  );
  readonly customCount = computed(
    () => this.limitsService.ruleTemplatesState().filter((r) => r.category === 'CUSTOM').length
  );

  // Navegação
  goBack(): void {
    this.router.navigate(['/alcadas/minhas-alcadas']);
  }

  goToEditor(): void {
    this.router.navigate(['/alcadas/editor', 'ALC-7781']);
  }

  setMode(mode: RuleCreationMode): void {
    this.activeMode.set(mode);
  }

  setFilter(filter: 'all' | 'standard' | 'custom'): void {
    this.selectedFilter.set(filter);
  }

  toggleDrawer(): void {
    this.isDrawerExpanded.update((v) => !v);
  }

  openDrawer(): void {
    this.isDrawerExpanded.set(true);
  }

  closeDrawer(): void {
    this.isDrawerExpanded.set(false);
  }

  // 1. Métodos do Assistente IA
  useSuggestion(promptText: string): void {
    this.aiPrompt.set(promptText);
    this.generateRuleWithAi();
  }

  generateRuleWithAi(): void {
    const prompt = this.aiPrompt().trim();
    if (!prompt) return;

    this.isAiGenerating.set(true);
    this.aiChatHistory.update((h) => [...h, { sender: 'user', text: prompt }]);

    setTimeout(() => {
      // Simulação de geração inteligente com IA baseada no prompt
      let generated: RuleTemplateItem;

      if (prompt.toLowerCase().includes('50') || prompt.toLowerCase().includes('diretor')) {
        generated = {
          type: 'APPROVER',
          title: 'Alçada Diretoria: Dupla Aprovação > R$ 50k',
          description: 'Regra gerada por IA: Exige assinatura mútua de dois Diretores para valores acima de R$ 50.000.',
          icon: 'group',
          badge: 'Quórum Duplo Diretoria',
          badgeColor: '#8B5CF6',
          category: 'CUSTOM',
          creationMethod: 'AI_PROMPT',
          createdBy: 'Assistente IA de Alçadas',
          createdAt: 'Agora',
          usageCount: 0,
          defaultConfig: {
            approverRole: 'DIRETOR',
            quorum: 'DUPLO',
            enforceSod: true,
          },
        };
      } else if (prompt.toLowerCase().includes('12') || prompt.toLowerCase().includes('emerg')) {
        generated = {
          type: 'SLA_TIMER',
          title: 'Fast-Track Emergencial: SLA 12h',
          description: 'Regra gerada por IA: Limite estrito de 12 horas para deliberação antes do escalonamento ao superior imediato.',
          icon: 'bolt',
          badge: 'SLA Crítico 12h',
          badgeColor: '#F59E0B',
          category: 'CUSTOM',
          creationMethod: 'AI_PROMPT',
          createdBy: 'Assistente IA de Alçadas',
          createdAt: 'Agora',
          usageCount: 0,
          defaultConfig: {
            slaHours: 12,
            escalateTo: 'SUPERIOR_DIRETO',
          },
        };
      } else {
        generated = {
          type: 'CONDITION_VALUE',
          title: 'Regra Customizada: ' + (prompt.slice(0, 32) + '...'),
          description: `Regra estruturada a partir da política: "${prompt}"`,
          icon: 'calculate',
          badge: 'Regra de Teto Especial',
          badgeColor: '#644EF3',
          category: 'CUSTOM',
          creationMethod: 'AI_PROMPT',
          createdBy: 'Assistente IA de Alçadas',
          createdAt: 'Agora',
          usageCount: 0,
          defaultConfig: {
            operator: '<=',
            valueMax: 45000,
            currency: 'BRL',
          },
        };
      }

      this.aiGeneratedRule.set(generated);
      this.aiChatHistory.update((h) => [
        ...h,
        {
          sender: 'assistant',
          text: `Analisei sua solicitação de governança e estruturei a regra corporativa abaixo. Ela inclui verificações de quórum, integridade e segregação de funções (SoD).`,
          rulePreview: generated,
        },
      ]);
      this.aiPrompt.set('');
      this.isAiGenerating.set(false);
    }, 700);
  }

  saveAiRule(rule: RuleTemplateItem): void {
    this.limitsService.addRuleTemplate(rule);
    this.showSuccess(`Regra "${rule.title}" adicionada com sucesso ao catálogo!`);
    this.aiGeneratedRule.set(null);
    this.openDrawer();
  }

  // 2. Métodos de Importação de Documento
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files.length) {
      this.simulateDocUpload(event.dataTransfer.files[0].name);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.simulateDocUpload(input.files[0].name);
    }
  }

  simulateDocUpload(fileName: string): void {
    this.uploadedFileName.set(fileName);
    this.isDocProcessing.set(true);

    setTimeout(() => {
      this.isDocProcessing.set(false);
      this.extractedDocRules.set([
        {
          type: 'CONDITION_VALUE',
          title: 'Cláusula 4.1: Teto Contratual de TI (R$ 60.000)',
          description: `Extraído do documento "${fileName}": Despesas de software e licenciamento com limite de R$ 60.000.`,
          icon: 'cloud_done',
          badge: 'Teto TI Doc',
          badgeColor: '#3B82F6',
          category: 'CUSTOM',
          creationMethod: 'DOCUMENT',
          createdBy: `Arquivo: ${fileName}`,
          createdAt: 'Hoje',
          usageCount: 0,
          defaultConfig: {
            operator: '<=',
            valueMax: 60000,
            currency: 'BRL',
          },
        },
        {
          type: 'APPROVER',
          title: 'Cláusula 9.3: Comitê de Compliance Obrigatório',
          description: `Extraído do documento "${fileName}": Exige triagem anti-corrupção e assinatura de 2 auditores cadastrados.`,
          icon: 'verified_user',
          badge: 'Compliance Estrito',
          badgeColor: '#EC4899',
          category: 'CUSTOM',
          creationMethod: 'DOCUMENT',
          createdBy: `Arquivo: ${fileName}`,
          createdAt: 'Hoje',
          usageCount: 0,
          defaultConfig: {
            approverRole: 'DIRETOR',
            quorum: 'DUPLO',
            enforceSod: true,
          },
        },
      ]);
    }, 850);
  }

  saveExtractedRule(rule: RuleTemplateItem): void {
    this.limitsService.addRuleTemplate(rule);
    this.extractedDocRules.update((list) => list.filter((r) => r.title !== rule.title));
    this.showSuccess(`Regra "${rule.title}" extraída do documento foi homologada e adicionada ao catálogo!`);
    this.openDrawer();
  }

  // 3. Métodos do Criador Manual
  saveManualRule(): void {
    const title = this.manualTitle().trim() || 'Regra Personalizada Manual';
    const type = this.manualType();

    let badge = 'Regra Manual';
    let badgeColor = '#644EF3';
    let icon = 'tune';

    if (type === 'CONDITION_VALUE') {
      badge = `Teto ${this.manualOperator()} R$ ${this.manualAmount().toLocaleString('pt-BR')}`;
      icon = 'calculate';
      badgeColor = '#644EF3';
    } else if (type === 'APPROVER') {
      badge = this.manualQuorum() === 'DUPLO' ? 'Quórum Duplo' : '1 Assinatura';
      icon = this.manualQuorum() === 'DUPLO' ? 'group' : 'person_check';
      badgeColor = '#10B981';
    } else if (type === 'SLA_TIMER') {
      badge = `SLA ${this.manualSlaHours()}h`;
      icon = 'schedule';
      badgeColor = '#F59E0B';
    } else if (type === 'RISK_CHECK') {
      badge = 'Anti-Fraude SoD';
      icon = 'security';
      badgeColor = '#EC4899';
    }

    const newRule: RuleTemplateItem = {
      type,
      title,
      description: this.manualDesc().trim() || 'Regra parametrizada manualmente pelo Administrador.',
      icon,
      badge,
      badgeColor,
      category: 'CUSTOM',
      creationMethod: 'MANUAL',
      createdBy: 'Criado Manualmente por Admin',
      createdAt: 'Hoje',
      usageCount: 0,
      defaultConfig: {
        operator: this.manualOperator(),
        valueMax: this.manualAmount(),
        approverRole: this.manualRole(),
        quorum: this.manualQuorum(),
        slaHours: this.manualSlaHours(),
        enforceSod: this.manualSod(),
      },
    };

    this.limitsService.addRuleTemplate(newRule);
    this.showSuccess(`Regra manual "${title}" salva com sucesso no catálogo corporativo!`);
    this.openDrawer();
  }

  deleteRule(rule: RuleTemplateItem, event: Event): void {
    event.stopPropagation();
    if (rule.category === 'STANDARD') return;
    this.limitsService.deleteRuleTemplate(rule.title);
    this.showSuccess(`Regra "${rule.title}" removida do catálogo.`);
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 3500);
  }
}
