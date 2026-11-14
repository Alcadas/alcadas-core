import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface TourStep {
  targetSelector?: string;
  title: string;
  description: string;
  badge?: string;
  icon?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  actionHint?: string;
}

export interface TabTutorialGuide {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  category: string;
  estimatedMinutes: number;
  steps: {
    title: string;
    description: string;
    tip?: string;
    warning?: string;
    icon?: string;
  }[];
}

const STORAGE_KEY_WELCOME_SEEN = 'alcadas_has_seen_welcome_v1';
const STORAGE_KEY_COMPLETED_TOURS = 'alcadas_completed_tours_v1';

@Injectable({
  providedIn: 'root',
})
export class TourService {
  private readonly router = inject(Router);

  // Estado do Modal de Boas-vindas
  readonly showWelcomeModal = signal<boolean>(false);

  // Estado do Tour Interativo
  readonly isTourActive = signal<boolean>(false);
  readonly currentStepIndex = signal<number>(0);
  readonly currentContext = signal<string>('dashboard');
  readonly tourSteps = signal<TourStep[]>([]);

  readonly currentStep = computed<TourStep | null>(() => {
    const steps = this.tourSteps();
    const index = this.currentStepIndex();
    return steps[index] ?? null;
  });

  readonly isFirstStep = computed(() => this.currentStepIndex() === 0);
  readonly isLastStep = computed(() => {
    const total = this.tourSteps().length;
    return total > 0 && this.currentStepIndex() === total - 1;
  });

  readonly progressPercentage = computed(() => {
    const total = this.tourSteps().length;
    if (total <= 1) return 100;
    return Math.round(((this.currentStepIndex() + 1) / total) * 100);
  });

  // Catálogo completo de passos interativos por tela / aba
  private readonly toursCatalog: Record<string, TourStep[]> = {
    dashboard: [
      {
        targetSelector: '.page-header-tier1',
        title: 'Bem-vindo ao Centro de Operações',
        description: 'Aqui você acompanha o pulso orçamentário da organização em tempo real, monitorando gastos, pendências e conformidade.',
        badge: 'Visão Geral',
        icon: 'dashboard',
        position: 'bottom',
        actionHint: 'Observe a navegação e alertas no topo da tela.',
      },
      {
        targetSelector: '.dashboard-kpis-grid',
        title: 'Indicadores Principais (KPIs)',
        description: 'Cards limpos e diretos com o total comprometido do orçamento, quantidade de solicitações pendentes na esteira e pedidos finalizados.',
        badge: 'Orçamento & Fila',
        icon: 'payments',
        position: 'bottom',
        actionHint: 'Clique nas pendências para ir direto à lista de aprovações.',
      },
      {
        targetSelector: '.chart-main-column',
        title: 'Tendência Financeira de Solicitações',
        description: 'Gráfico visual comparando o volume de solicitações ao longo do tempo com a linha de média orçamentária aceita pela governança.',
        badge: 'Análise de Tendência',
        icon: 'bar_chart',
        position: 'right',
      },
      {
        targetSelector: '.usage-card',
        title: 'Consumo por Departamento',
        description: 'Barra segmentada e detalhamento do orçamento consumido por cada centro de custo (TI, Marketing, RH, Financeiro).',
        badge: 'Centros de Custo',
        icon: 'pie_chart',
        position: 'left',
      },
    ],
    solicitacoes: [
      {
        targetSelector: '.page-header-tier1',
        title: 'Central de Solicitações',
        description: 'Esta é a tela onde você cria, acompanha e consulta o histórico de todas as solicitações de compra e despesas da empresa.',
        badge: 'Suas Solicitações',
        icon: 'receipt_long',
        position: 'bottom',
      },
      {
        targetSelector: '.toolbar-section',
        title: 'Filtros Rápidos & Busca',
        description: 'Filtre suas solicitações por Categoria de Despesa, Centro de Custo responsável ou ordene por data e maior valor monetário.',
        badge: 'Filtros Dinâmicos',
        icon: 'filter_alt',
        position: 'bottom',
      },
      {
        targetSelector: '.table-actions-strip',
        title: 'Exportação e Novo Pedido',
        description: 'Gere relatórios CSV para auditoria ou clique em "Nova Solicitação" para abrir um pedido anexando cotações e justificativa.',
        badge: 'Ações Principais',
        icon: 'add_circle',
        position: 'bottom',
      },
      {
        targetSelector: '.table-container-card',
        title: 'Tabela de Acompanhamento',
        description: 'Acompanhe o status em tempo real (Rascunho, Pendente, Aprovado, Ajuste Solicitado), quem é o aprovador atual e o código único.',
        badge: 'Esteira Ativa',
        icon: 'table_rows',
        position: 'top',
      },
    ],
    aprovacoes: [
      {
        targetSelector: '.page-header-tier1',
        title: 'Fila de Minhas Aprovações',
        description: 'Aqui aparecem todas as solicitações que requerem sua deliberação formal, baseadas na alçada de valor e no seu departamento.',
        badge: 'Deliberação Executiva',
        icon: 'check_circle',
        position: 'bottom',
      },
      {
        targetSelector: '.table-actions-strip',
        title: 'Aprovação em Lote & Assinatura Digital',
        description: 'Selecione múltiplos pedidos para deliberar de uma só vez, gerando assinaturas criptográficas SHA-256 com sua credencial.',
        badge: 'Eficiência com Segurança',
        icon: 'done_all',
        position: 'bottom',
      },
      {
        targetSelector: '.table-container-card',
        title: 'Análise de Conformidade e SoD',
        description: 'O sistema bloqueia conflitos de interesse: quem solicita um pedido nunca pode aprovar a si mesmo (Segregação de Funções).',
        badge: 'Compliance & SoD',
        icon: 'verified_user',
        position: 'top',
      },
    ],
    'meus-fluxos': [
      {
        targetSelector: '.page-header-tier1',
        title: 'Gestor de Fluxos de Alçadas',
        description: 'Configure os caminhos que um pedido percorre desde o envio até a autorização de pagamento.',
        badge: 'Esteiras de Decisão',
        icon: 'account_tree',
        position: 'bottom',
      },
      {
        targetSelector: '.table-container-card, .flows-list-grid, .content-container',
        title: 'Regras de Alçada por Faixa de Valor',
        description: 'Defina limites: por exemplo, até R$ 10.000 aprovação de Gerente; acima de R$ 50.000 exige parecer do Diretor Financeiro (CFO).',
        badge: 'Tetos Financeiros',
        icon: 'rule',
        position: 'top',
      },
    ],
    organizacao: [
      {
        targetSelector: '.page-header-tier1, .settings-identity-header',
        title: 'Quadro da Organização & Empresa',
        description: 'Gerencie os pilares cadastrais da sua empresa: dados corporativos, departamentos com centros de custo e colaboradores.',
        badge: 'Governança Corporativa',
        icon: 'domain',
        position: 'bottom',
      },
      {
        targetSelector: '.settings-tabs-nav',
        title: 'Abas Organizacionais',
        description: 'Navegue entre "Dados da Empresa", "Departamentos & Centros de Custo", "Funcionários & Alçadas" e "Políticas de Projeto".',
        badge: 'Navegação em Abas',
        icon: 'tab',
        position: 'bottom',
      },
      {
        targetSelector: '.org-items-list',
        title: 'Departamentos e Equipe Vinculada',
        description: 'Clique em qualquer departamento para expandir e ver quais colaboradores fazem parte dele, seus cargos e limites de aprovação.',
        badge: 'Visualização Expansível',
        icon: 'group',
        position: 'top',
      },
    ],
  };

  constructor() {
    this.checkInitialWelcomeState();
  }

  private checkInitialWelcomeState(): void {
    if (typeof window === 'undefined') return;
    try {
      const hasSeen = localStorage.getItem(STORAGE_KEY_WELCOME_SEEN);
      if (!hasSeen) {
        // Aguarda breve inicialização da UI antes de exibir o welcome modal
        setTimeout(() => {
          this.showWelcomeModal.set(true);
        }, 600);
      }
    } catch {
      // Ignora erro de acesso ao localStorage
    }
  }

  openWelcomeModal(): void {
    this.showWelcomeModal.set(true);
  }

  dismissWelcomeModal(neverShowAgain = true): void {
    this.showWelcomeModal.set(false);
    if (neverShowAgain && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_WELCOME_SEEN, 'true');
      } catch {
        // Ignora
      }
    }
  }

  startTourFromWelcome(): void {
    this.dismissWelcomeModal(true);
    // Inicia o tour para a tela atual ou dashboard
    const currentUrl = this.router.url;
    let context = 'dashboard';
    if (currentUrl.includes('/solicitacoes')) context = 'solicitacoes';
    else if (currentUrl.includes('/aprovacoes')) context = 'aprovacoes';
    else if (currentUrl.includes('/alcadas')) context = 'meus-fluxos';
    else if (currentUrl.includes('/organizacao')) context = 'organizacao';

    this.startTour(context);
  }

  startTour(contextKey = 'dashboard'): void {
    const steps = this.toursCatalog[contextKey] || this.toursCatalog['dashboard'];
    this.currentContext.set(contextKey);
    this.tourSteps.set(steps);
    this.currentStepIndex.set(0);
    this.isTourActive.set(true);
    this.scrollToActiveTarget();
  }

  nextStep(): void {
    const nextIdx = this.currentStepIndex() + 1;
    if (nextIdx < this.tourSteps().length) {
      this.currentStepIndex.set(nextIdx);
      this.scrollToActiveTarget();
    } else {
      this.endTour();
    }
  }

  prevStep(): void {
    const prevIdx = this.currentStepIndex() - 1;
    if (prevIdx >= 0) {
      this.currentStepIndex.set(prevIdx);
      this.scrollToActiveTarget();
    }
  }

  endTour(): void {
    this.isTourActive.set(false);
    this.markTourAsCompleted(this.currentContext());
  }

  private scrollToActiveTarget(): void {
    if (typeof window === 'undefined') return;
    const step = this.currentStep();
    const selector = step?.targetSelector;
    if (!selector) return;

    setTimeout(() => {
      try {
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {
        // Seletor não encontrado ou inválido, mantém sem scroll
      }
    }, 150);
  }

  private markTourAsCompleted(context: string): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COMPLETED_TOURS);
      const list: string[] = stored ? JSON.parse(stored) : [];
      if (!list.includes(context)) {
        list.push(context);
        localStorage.setItem(STORAGE_KEY_COMPLETED_TOURS, JSON.stringify(list));
      }
    } catch {
      // Ignora
    }
  }

  navigateToTutorials(): void {
    this.dismissWelcomeModal(false);
    void this.router.navigate(['/tutoriais']);
  }
}
