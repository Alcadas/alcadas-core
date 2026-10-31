import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RuleTemplateItem, WorkflowNode } from './limits.models';
import { LimitsService } from './services/limits.service';

@Component({
  selector: 'app-limits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './limits.component.html',
  styleUrl: './limits.component.scss',
})
export class LimitsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly limitsService = inject(LimitsService);

  // Identificação da Alçada Atual
  readonly currentRuleId = signal<string | null>(null);
  readonly currentRuleTitle = signal<string>('Configuração de Alçadas & Tetos');

  // Zoom e Pan do Canvas de Fluxo
  readonly zoomLevel = signal(100);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly isDragging = signal(false);

  // Posições para o cálculo de drag com o mouse
  private dragStartX = 0;
  private dragStartY = 0;
  private initialPanX = 0;
  private initialPanY = 0;

  // Inserção contextual de nós (+ entre cards)
  readonly pendingInsertIndex = signal<number | null>(null);

  // Sidebar Esquerdo de Modelos de Regras (começa recolhido, porém visível na tela)
  readonly isLibraryExpanded = signal(false);

  // Notificação de Salvo
  readonly saveSuccessMessage = signal<string | null>(null);

  // Busca na Biblioteca de Modelos
  readonly templateSearch = signal('');

  // 1. Modelos Disponíveis na Biblioteca Lateral Esquerda
  readonly ruleTemplates = signal<RuleTemplateItem[]>([
    {
      type: 'CONDITION_VALUE',
      title: 'Teto de Valor (<, >, =)',
      description: 'Define limites monetários para disparar alçada ou escalonar aprovação.',
      icon: 'calculate',
      badge: 'Regra de Teto',
      badgeColor: '#644EF3',
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
      defaultConfig: {
        costCenter: 'CC-104 - TI e Infra',
        category: 'Hardware & Equipamentos',
      },
    },
  ]);

  // Modelos filtrados pela barra de busca
  readonly filteredTemplates = computed(() => {
    const query = this.templateSearch().trim().toLowerCase();
    if (!query) return this.ruleTemplates();
    return this.ruleTemplates().filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.badge.toLowerCase().includes(query)
    );
  });

  // 2. Nós do Fluxo Sequencial Atual (Pipeline)
  readonly workflowNodes = signal<WorkflowNode[]>([
    {
      id: 'node-1',
      type: 'TRIGGER',
      title: 'Início: Solicitação Criada',
      subtitle: 'Disparado pelo Portal de Requisições ou ERP integrado',
      tag: 'Origem',
      tagColor: '#3B82F6',
      icon: 'play_arrow',
      config: {
        costCenter: 'CC-104 - TI e Infra',
        category: 'Licenciamento & Cloud',
      },
    },
    {
      id: 'node-2',
      type: 'RISK_CHECK',
      title: 'Triagem de Risco & Segregação (SoD)',
      subtitle: 'Bloqueio de autorrequisição e verificação anti-fracionamento em 30 dias',
      tag: 'Motor de Risco',
      tagColor: '#EC4899',
      icon: 'security',
      config: {
        riskWindowDays: 30,
        checkDuplicate: true,
        checkSplit: true,
      },
    },
    {
      id: 'node-3',
      type: 'CONDITION_VALUE',
      title: 'Teto Gerência Operacional (<= R$ 15.000)',
      subtitle: 'Solicitações abaixo de R$ 15.000 são liberadas por 1 Gerente',
      tag: 'Valor <= R$ 15.000',
      tagColor: '#644EF3',
      icon: 'calculate',
      config: {
        operator: '<=',
        valueMin: 0,
        valueMax: 15000,
        currency: 'BRL',
      },
    },
    {
      id: 'node-4',
      type: 'APPROVER',
      title: 'Aprovação Individual do Gerente',
      subtitle: 'Assinatura digital com chave privada do Gerente do Centro de Custo',
      tag: '1 Assinatura',
      tagColor: '#10B981',
      icon: 'person_check',
      config: {
        approverRole: 'GERENTE',
        quorum: 'UNICO',
        enforceSod: true,
      },
    },
    {
      id: 'node-5',
      type: 'SLA_TIMER',
      title: 'SLA de Decisão: 48 Horas',
      subtitle: 'Caso expire, escalona para Diretoria Executiva',
      tag: 'Tempo Máx: 48h',
      tagColor: '#F59E0B',
      icon: 'schedule',
      config: {
        slaHours: 48,
        escalateTo: 'SUPERIOR_DIRETO',
      },
    },
    {
      id: 'node-6',
      type: 'TERMINAL',
      title: 'Homologação & Trilha SHA-256',
      subtitle: 'Gravação de elo criptográfico e liberação para pagamento',
      tag: 'Concluído',
      tagColor: '#059669',
      icon: 'verified',
      config: {},
    },
  ]);

  // Começa com NENHUM nó selecionado (conforme solicitado pelo usuário!)
  readonly selectedNodeId = signal<string | null>(null);

  // Objeto do nó selecionado
  readonly selectedNode = computed(() => {
    const id = this.selectedNodeId();
    if (!id) return null;
    return this.workflowNodes().find((n) => n.id === id) || null;
  });

  selectNode(id: string): void {
    this.selectedNodeId.set(id);
  }

  closeInspector(): void {
    this.selectedNodeId.set(null);
  }

  // Controle da Biblioteca de Modelos (Sidebar Retrátil Esquerdo)
  toggleLibrary(): void {
    this.isLibraryExpanded.update((v) => !v);
  }

  expandLibrary(): void {
    this.isLibraryExpanded.set(true);
  }

  collapseLibrary(): void {
    this.isLibraryExpanded.set(false);
  }

  // Início de inserção contextual (+) entre cards
  startInsertBetween(index: number, event: Event): void {
    event.stopPropagation();
    this.pendingInsertIndex.set(index + 1);
    this.isLibraryExpanded.set(true); // Expande a biblioteca para que o usuário escolha o modelo
  }

  cancelInsert(): void {
    this.pendingInsertIndex.set(null);
  }

  // Adiciona novo nó no fluxo baseado num modelo da esquerda
  addNode(template: RuleTemplateItem): void {
    const newId = 'node-' + (Date.now() % 10000);
    const newNode: WorkflowNode = {
      id: newId,
      type: template.type,
      title: template.title,
      subtitle: template.description,
      tag: template.badge,
      tagColor: template.badgeColor,
      icon: template.icon,
      isNew: true, // Borda dashed e indicação clara de nova regra em criação
      config: { ...template.defaultConfig },
    };

    const insertIdx = this.pendingInsertIndex();
    this.workflowNodes.update((nodes) => {
      const copy = [...nodes];
      if (insertIdx !== null && insertIdx >= 0 && insertIdx <= copy.length) {
        copy.splice(insertIdx, 0, newNode);
      } else {
        const lastIndex = copy.length - 1;
        if (lastIndex >= 0 && copy[lastIndex].type === 'TERMINAL') {
          copy.splice(lastIndex, 0, newNode);
        } else {
          copy.push(newNode);
        }
      }
      return copy;
    });

    this.pendingInsertIndex.set(null);
    this.isLibraryExpanded.set(false); // Recolhe a biblioteca para focar no inspetor
    this.selectedNodeId.set(newId); // Expande a barra lateral direita para a regra recém-criada
  }

  // Remove um nó do fluxo
  deleteNode(id: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.workflowNodes.update((nodes) => nodes.filter((n) => n.id !== id));
    if (this.selectedNodeId() === id) {
      this.selectedNodeId.set(null);
    }
  }

  // Move nó para cima ou para baixo
  moveNode(index: number, direction: 'up' | 'down', event: Event): void {
    event.stopPropagation();
    this.workflowNodes.update((nodes) => {
      const copy = [...nodes];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return copy;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  }

  // Atualiza campo no nó selecionado
  updateConfig(key: keyof WorkflowNode['config'], value: unknown): void {
    const node = this.selectedNode();
    if (!node) return;

    this.workflowNodes.update((nodes) =>
      nodes.map((n) => {
        if (n.id === node.id) {
          const updatedConfig = { ...n.config, [key]: value };
          let updatedTag = n.tag;

          if (n.type === 'CONDITION_VALUE' && key === 'valueMax') {
            updatedTag = `Valor ${updatedConfig.operator || '<='} R$ ${Number(value).toLocaleString('pt-BR')}`;
          }
          if (n.type === 'APPROVER' && key === 'quorum') {
            updatedTag = value === 'DUPLO' ? 'Quórum Duplo' : '1 Assinatura';
          }
          if (n.type === 'SLA_TIMER' && key === 'slaHours') {
            updatedTag = `Tempo Máx: ${value}h`;
          }

          return {
            ...n,
            config: updatedConfig,
            tag: updatedTag,
          };
        }
        return n;
      })
    );
  }

  updateNodeField(field: 'title' | 'subtitle', value: string): void {
    const node = this.selectedNode();
    if (!node) return;

    this.workflowNodes.update((nodes) =>
      nodes.map((n) => (n.id === node.id ? { ...n, [field]: value } : n))
    );
  }

  // Pan & Drag Handlers com o Mouse
  onCanvasMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        '.flow-node-card, .btn-insert-rule, .rules-library, .rule-inspector, .canvas-controls, .ops-header, button, input, select, textarea'
      )
    ) {
      return;
    }

    this.isDragging.set(true);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.initialPanX = this.panX();
    this.initialPanY = this.panY();
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.panX.set(this.initialPanX + dx);
    this.panY.set(this.initialPanY + dy);
  }

  onCanvasMouseUp(): void {
    this.isDragging.set(false);
  }

  // Zoom dinâmico com Ctrl + Scroll
  onCanvasWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 8 : -8;
      this.zoomLevel.update((z) => Math.min(Math.max(z + delta, 40), 200));
    }
  }

  // Controles de Zoom e Câmera
  zoomIn(): void {
    this.zoomLevel.update((z) => Math.min(z + 10, 180));
  }

  zoomOut(): void {
    this.zoomLevel.update((z) => Math.max(z - 10, 40));
  }

  resetZoom(): void {
    this.zoomLevel.set(100);
  }

  centerCanvas(): void {
    this.panX.set(0);
    this.panY.set(0);
    this.zoomLevel.set(100);
  }

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.currentRuleId.set(id);
      const rule = this.limitsService.getRuleById(id);
      if (rule) {
        this.currentRuleTitle.set(rule.title);
      } else {
        this.currentRuleTitle.set(`Alçada #${id}`);
      }
    }
  }

  goBack(): void {
    this.router.navigate(['/alcadas/minhas-alcadas']);
  }

  saveWorkflow(): void {
    // Remove o indicador isNew de todos os nós após o salvamento
    this.workflowNodes.update((nodes) =>
      nodes.map((n) => ({ ...n, isNew: false }))
    );
    this.saveSuccessMessage.set('Workflow de alçadas salvo e versionado com sucesso!');
    setTimeout(() => {
      this.saveSuccessMessage.set(null);
    }, 3500);
  }
}
