import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  MODELOS_REGRAS_ALCADA,
  ModeloRegraAlcada,
  buscarModeloRegra,
} from '@alcadas-core/models';
import { LimitRuleStatus, RuleTemplateItem, WorkflowNode } from './limits.models';
import {
  buildWorkflowNodesFromFaixas,
  buildWorkflowNodesFromModelo,
  calculateCeilingFromNodes,
  formatCurrencyBRL,
} from './services/limits-workflow.utils';
import { LimitsService } from './services/limits.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-limits',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './limits.component.html',
  styleUrl: './limits.component.scss',
})
export class LimitsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly limitsService = inject(LimitsService);

  // Identificação e Metadados de Edição do Fluxo
  readonly currentRuleId = signal<string | null>(null);
  readonly currentRuleTitle = signal<string>('Fluxo de Compras & Capex de TI');
  readonly flowDepartment = signal<string>('Tecnologia da Informação');
  readonly flowCompany = signal<string>('Matriz Corporativa SP');
  readonly flowCategory = signal<string>('Licenciamento & Cloud');
  readonly flowStatus = signal<'ATIVO' | 'RASCUNHO' | 'HOMOLOGACAO'>('ATIVO');
  readonly flowThreshold = signal<number>(150000);
  readonly flowVersion = signal<string>('v2.4');

  // Departamentos e Unidades para Seleção
  readonly departmentsList = [
    'Tecnologia da Informação',
    'Compras & Suprimentos',
    'Finanças & Controladoria',
    'Recursos Humanos',
    'Jurídico & Compliance',
    'Operações & Logística',
  ];

  readonly companiesList = [
    'Matriz Corporativa SP',
    'Filial Rio de Janeiro',
    'Filial Curitiba',
    'Todas as Unidades (Global)',
  ];

  readonly categoriesList = [
    'Licenciamento & Cloud',
    'Equipamentos & Hardware',
    'Serviços & Terceirização',
    'Despesas Operacionais (OPEX)',
    'Investimentos de Capital (CAPEX)',
  ];

  // Estado de Carregamento da Esteira
  readonly isLoading = signal(true);

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

  // Alternância de abas na biblioteca lateral: 'market' (Modelos Pré-definidos) vs 'elements' (Componentes Unitários)
  readonly libraryTab = signal<'market' | 'elements'>('market');

  // Catálogo com os 4+ modelos pré-definidos de mercado (#69 / CP2)
  readonly marketModels = MODELOS_REGRAS_ALCADA;

  readonly filteredMarketModels = computed(() => {
    const query = this.templateSearch().trim().toLowerCase();
    if (!query) return this.marketModels;
    return this.marketModels.filter(
      (m) =>
        m.nome.toLowerCase().includes(query) ||
        m.descricao.toLowerCase().includes(query) ||
        m.centroCustoSugerido.toLowerCase().includes(query) ||
        m.categoria.toLowerCase().includes(query),
    );
  });

  // 1. Modelos Disponíveis na Biblioteca Lateral (Centralizado via LimitsService)
  readonly ruleTemplates = this.limitsService.ruleTemplatesState;

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

  readonly formatCurrency = formatCurrencyBRL;

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
    let targetIndex = 0;

    this.workflowNodes.update((nodes) => {
      const copy = [...nodes];
      if (insertIdx !== null && insertIdx >= 0 && insertIdx <= copy.length) {
        copy.splice(insertIdx, 0, newNode);
        targetIndex = insertIdx;
      } else {
        const lastIndex = copy.length - 1;
        if (lastIndex >= 0 && copy[lastIndex].type === 'TERMINAL') {
          copy.splice(lastIndex, 0, newNode);
          targetIndex = lastIndex;
        } else {
          copy.push(newNode);
          targetIndex = copy.length - 1;
        }
      }
      return copy;
    });

    this.pendingInsertIndex.set(null);
    this.isLibraryExpanded.set(false); // Recolhe a biblioteca para focar no inspetor
    this.selectedNodeId.set(newId); // Expande a barra lateral direita para a regra recém-criada

    // Mover suavemente a tela (pan) até a nova regra e dar foco nela
    this.focusNode(newId, targetIndex);
  }

  // Foca e centraliza a câmera na regra adicionada
  focusNode(nodeId: string, index: number): void {
    const estimatedOffset = index * 170;
    const targetPanY = -Math.max(0, estimatedOffset - 120);

    this.panX.set(0);
    this.panY.set(targetPanY);

    setTimeout(() => {
      const el = document.getElementById(nodeId);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
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
        if (rule.department) this.flowDepartment.set(rule.department);
        if (rule.locationOrCenter) this.flowCompany.set(rule.locationOrCenter);
        if (rule.category) this.flowCategory.set(rule.category);
        if (rule.status) {
          this.flowStatus.set(
            rule.status === 'ACTIVE'
              ? 'ATIVO'
              : rule.status === 'COMPLETED'
                ? 'HOMOLOGACAO'
                : 'RASCUNHO',
          );
        }
        if (rule.ceilingAmount) this.flowThreshold.set(rule.ceilingAmount);

        // Se o fluxo já possui nós persistidos ou faixas configuradas, carrega no canvas
        if (rule.nodes && rule.nodes.length > 0) {
          this.workflowNodes.set(rule.nodes);
        } else if (rule.faixas && rule.faixas.length > 0) {
          const generated = buildWorkflowNodesFromFaixas(rule.faixas, {
            ruleTitle: rule.title,
            costCenter: rule.locationOrCenter || rule.department,
            quorum: rule.quorumLabel,
            slaHours: rule.slaHours,
            category: rule.category,
          });
          this.workflowNodes.set(generated);
        }
      } else {
        this.currentRuleTitle.set(`Alçada #${id}`);
      }
    } else {
      // Se não há ID na rota (ex: /alcadas/novo), verifica queryParam ?modelo=...
      const modeloId = this.route.snapshot.queryParamMap.get('modelo');
      if (modeloId) {
        const modelo = buscarModeloRegra(modeloId);
        if (modelo) {
          this.applyMarketModel(modelo);
        }
      }
    }

    // Simula carregamento da esteira e conexão de rede com o backend
    setTimeout(() => {
      this.isLoading.set(false);
    }, 600);
  }

  /**
   * Aplica um modelo pré-definido de mercado (#69) diretamente à esteira do editor.
   * Substitui os nós atuais pela esteira determinística correspondente às faixas do modelo.
   */
  applyMarketModel(modelo: ModeloRegraAlcada): void {
    this.currentRuleTitle.set(modelo.nome);

    const categoryMap: Record<string, string> = {
      CAPEX: 'Equipamentos & Hardware',
      OPERATIONAL: 'Despesas Operacionais (OPEX)',
      CONTRACTS: 'Serviços & Terceirização',
      GOVERNANCE: 'Licenciamento & Cloud',
      AUDIT: 'Investimentos de Capital (CAPEX)',
    };
    const category = categoryMap[modelo.categoria] || 'Despesas Operacionais (OPEX)';
    this.flowCategory.set(category);

    const dept =
      modelo.centroCustoSugerido.includes('·')
        ? modelo.centroCustoSugerido.split('·')[1].trim()
        : modelo.centroCustoSugerido || 'Operações & Logística';

    if (this.departmentsList.includes(dept)) {
      this.flowDepartment.set(dept);
    } else {
      this.flowDepartment.set(this.departmentsList[0]);
    }

    const generatedNodes = buildWorkflowNodesFromModelo(modelo, {
      costCenter: modelo.centroCustoSugerido,
      category,
      initialIsNew: true,
    });

    this.workflowNodes.set(generatedNodes);
    this.flowThreshold.set(calculateCeilingFromNodes(generatedNodes));
    this.selectedNodeId.set(null);
    this.isLibraryExpanded.set(false);
    this.centerCanvas();

    this.saveSuccessMessage.set(
      `Modelo "${modelo.nome}" aplicado com ${modelo.faixas.length} faixa(s) de alçada! Clique em Salvar Fluxo para persistir.`,
    );
    setTimeout(() => {
      this.saveSuccessMessage.set(null);
    }, 4500);
  }

  goBack(): void {
    this.router.navigate(['/alcadas/minhas-alcadas']);
  }

  goToRulesCatalog(): void {
    this.router.navigate(['/alcadas/regras']);
  }

  saveWorkflow(): void {
    // Remove o indicador isNew de todos os nós após o salvamento
    this.workflowNodes.update((nodes) =>
      nodes.map((n) => ({ ...n, isNew: false }))
    );

    const ruleId = this.currentRuleId() || `ALC-${Math.floor(1000 + Math.random() * 9000)}`;
    this.currentRuleId.set(ruleId);

    const statusVal: LimitRuleStatus =
      this.flowStatus() === 'ATIVO'
        ? 'ACTIVE'
        : this.flowStatus() === 'HOMOLOGACAO'
          ? 'COMPLETED'
          : 'DRAFT';

    const ceiling = calculateCeilingFromNodes(this.workflowNodes());

    this.limitsService.saveWorkflow(ruleId, {
      title: this.currentRuleTitle().trim() || 'Fluxo de Alçadas',
      department: this.flowDepartment(),
      company: this.flowCompany(),
      category: this.flowCategory(),
      status: statusVal,
      ceilingAmount: ceiling || this.flowThreshold(),
      nodes: this.workflowNodes(),
    });

    this.saveSuccessMessage.set('Workflow de alçadas salvo e versionado com sucesso no Firestore!');
    setTimeout(() => {
      this.saveSuccessMessage.set(null);
    }, 3500);
  }
}
