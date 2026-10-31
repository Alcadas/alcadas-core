import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RuleTemplateItem, WorkflowNode } from './limits.models';

@Component({
  selector: 'app-limits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './limits.component.html',
  styleUrl: './limits.component.scss',
})
export class LimitsComponent {
  // Zoom do Canvas de Fluxo
  readonly zoomLevel = signal(100);

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
      type: 'TERMINAL',
      title: 'Aprovação & Elo SHA-256',
      description: 'Conclusão da esteira, gravação do hash criptográfico e empenho financeiro.',
      icon: 'verified',
      badge: 'Conclusão',
      badgeColor: '#059669',
      defaultConfig: {},
    },
  ]);

  // Modelos filtrados pela busca
  readonly filteredTemplates = computed(() => {
    const q = this.templateSearch().toLowerCase().trim();
    if (!q) return this.ruleTemplates();
    return this.ruleTemplates().filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  });

  // 2. Fluxo Atual de Alçadas Configurado no Canvas Central
  readonly workflowNodes = signal<WorkflowNode[]>([
    {
      id: 'node-1',
      type: 'TRIGGER',
      title: 'Submissão de Solicitação',
      subtitle: 'Entrada de compra, reembolso ou contrato de serviço',
      tag: 'Ponto de Partida',
      tagColor: '#64748b',
      icon: 'input',
      config: {
        costCenter: 'TODOS',
        category: 'TODAS',
      },
    },
    {
      id: 'node-2',
      type: 'RISK_CHECK',
      title: 'Motor de Riscos & Fraudes',
      subtitle: 'Anti-fracionamento (30d) e bloqueio estrito de autoaprovação',
      tag: 'SoD Ativo',
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
      title: 'Faixa 1: Até R$ 15.000,00',
      subtitle: 'Solicitações de rotina operacional de baixo impacto',
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
      title: 'Aprovação: Gerente da Área',
      subtitle: 'Aprovador único titular do centro de custo',
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

  // Nó atualmente selecionado para edição no painel direito
  readonly selectedNodeId = signal<string | null>('node-3');

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
      config: { ...template.defaultConfig },
    };

    // Insere antes do nó terminal final se existir
    this.workflowNodes.update((nodes) => {
      const lastIndex = nodes.length - 1;
      if (lastIndex >= 0 && nodes[lastIndex].type === 'TERMINAL') {
        const copy = [...nodes];
        copy.splice(lastIndex, 0, newNode);
        return copy;
      }
      return [...nodes, newNode];
    });

    this.selectedNodeId.set(newId);
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

  // Controles de Zoom
  zoomIn(): void {
    this.zoomLevel.update((z) => Math.min(z + 10, 150));
  }

  zoomOut(): void {
    this.zoomLevel.update((z) => Math.max(z - 10, 60));
  }

  resetZoom(): void {
    this.zoomLevel.set(100);
  }

  saveWorkflow(): void {
    this.saveSuccessMessage.set('Workflow de alçadas atualizado e versionado com sucesso!');
    setTimeout(() => {
      this.saveSuccessMessage.set(null);
    }, 3500);
  }
}
