import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface TourStep {
  targetSelector?: string;
  route?: string;
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
    onboarding: [
      {
        targetSelector: 'aside.sidebar',
        route: '/dashboard',
        title: 'Menu Lateral de Operações',
        description: 'Aqui fica a navegação principal do Alçadas. Você transita entre todas as áreas de compras, aprovações, esteiras de governança e organização da sua empresa.',
        badge: 'Menu Lateral',
        icon: 'dock_to_left',
        position: 'right',
        actionHint: 'A barra lateral fica sempre acessível para facilitar o seu trabalho diário.',
      },
      {
        targetSelector: '[data-tour="sidebar-workspace"]',
        route: '/dashboard',
        title: 'Empresa & Tenant Ativo',
        description: 'Mostra a organização em que você está operando. Usuários com perfil Desenvolvedor ou Admin multi-empresa podem alternar entre tenants aqui.',
        badge: 'Ambiente',
        icon: 'domain',
        position: 'right',
        actionHint: 'Clique na empresa para ver detalhes cadastrais ou trocar de workspace.',
      },
      {
        targetSelector: '[data-tour="sidebar-dashboard"]',
        route: '/dashboard',
        title: '1. Menu: Dashboard Executivo',
        description: 'Acompanhe a visão executiva e indicadores em tempo real da sua empresa.',
        badge: 'Navegação',
        icon: 'dashboard',
        position: 'right',
        actionHint: '👉 Clique em Dashboard na sidebar para conferir as métricas.',
      },
      {
        targetSelector: '.dashboard-kpis-grid',
        route: '/dashboard',
        title: 'Indicadores Financeiros (KPIs)',
        description: 'Cards diretos com o total orçamentário comprometido, solicitações aguardando deliberação na fila, pedidos finalizados e conformidade com hashes SHA-256.',
        badge: 'Métricas Rápidas',
        icon: 'payments',
        position: 'bottom',
        actionHint: 'Clique no card de pendências para abrir direto a fila de deliberação.',
      },
      {
        targetSelector: '[data-tour="sidebar-solicitacoes"]',
        route: '/dashboard',
        title: '2. Menu: Minhas Solicitações',
        description: 'Central de compras e despesas corporativas. Vamos ver como submeter e gerenciar pedidos!',
        badge: 'Navegação',
        icon: 'receipt_long',
        position: 'right',
        actionHint: '👉 Clique no botão Minhas Solicitações na barra lateral para prosseguir.',
      },
      {
        targetSelector: '[data-tour="btn-new-request"]',
        route: '/solicitacoes',
        title: 'Central de Solicitações & Novo Pedido',
        description: 'Aqui colaboradores acompanham seus pedidos de compras e despesas. Clique em "Nova Solicitação" para iniciar um formulário guiado.',
        badge: 'Compras & Despesas',
        icon: 'add_circle',
        position: 'bottom',
        actionHint: 'Permite anexar PDFs e imagens de notas fiscais ou propostas.',
      },
      {
        targetSelector: '[data-tour="sidebar-aprovacoes"]',
        route: '/solicitacoes',
        title: '3. Menu: Minhas Aprovações',
        description: 'Sua esteira executiva de deliberação. Vamos conferir as pendências aguardando sua assinatura!',
        badge: 'Navegação',
        icon: 'how_to_reg',
        position: 'right',
        actionHint: '👉 Clique no botão Minhas Aprovações na barra lateral para avançar.',
      },
      {
        targetSelector: '.table-actions-strip',
        route: '/aprovacoes',
        title: 'Aprovação em Lote & Assinatura Digital',
        description: 'Selecione múltiplos pedidos para deliberar com um só clique, gerando assinaturas digitais SHA-256 e garantindo Segregação de Funções (SoD).',
        badge: 'Eficiência & Compliance',
        icon: 'done_all',
        position: 'bottom',
        actionHint: 'Nenhum gestor pode aprovar seus próprios pedidos.',
      },
      {
        targetSelector: '[data-tour="sidebar-meus-fluxos"]',
        route: '/aprovacoes',
        title: '4. Menu: Meus Fluxos',
        description: 'Parametrização visual de esteiras de alçada por centro de custo.',
        badge: 'Navegação',
        icon: 'account_tree',
        position: 'right',
        actionHint: '👉 Clique em Meus Fluxos na barra lateral para conhecer as esteiras.',
      },
      {
        targetSelector: 'app-page-header',
        route: '/alcadas/minhas-alcadas',
        title: 'Governança & Esteiras Sequenciais',
        description: 'Governança financeira automatizada: configure esteiras de aprovação sequenciais ou paralelas (Gerente ➔ Diretor ➔ CFO) por centro de custo.',
        badge: 'Esteiras de Decisão',
        icon: 'account_tree',
        position: 'bottom',
        actionHint: 'Visualize SLAs e quóruns de aprovação estabelecidos.',
      },
      {
        targetSelector: '[data-tour="sidebar-minhas-regras"]',
        route: '/alcadas/minhas-alcadas',
        title: '5. Menu: Minhas Regras',
        description: 'Catálogo de políticas corporativas, tetos por área e regras de substitutos.',
        badge: 'Navegação',
        icon: 'rule',
        position: 'right',
        actionHint: '👉 Clique em Minhas Regras na barra lateral para visualizar as regras.',
      },
      {
        targetSelector: 'app-page-header',
        route: '/alcadas/regras',
        title: 'Catálogo de Políticas & Tetos',
        description: 'Catálogo de políticas corporativas: cadastre tetos financeiros por departamento, regras de substituição de gestores ausentes e modelos predefinidos.',
        badge: 'Políticas & Tetos',
        icon: 'rule',
        position: 'bottom',
        actionHint: 'Ative ou desative regras corporativas a qualquer momento.',
      },
      {
        targetSelector: '[data-tour="sidebar-departments"]',
        route: '/dashboard',
        title: 'Departamentos & Centros de Custo',
        description: 'Visualize os departamentos ativos (TI, Marketing, RH, Financeiro) e fixe seus centros de custo preferidos para acompanhar o consumo com facilidade.',
        badge: 'Organização',
        icon: 'group',
        position: 'right',
        actionHint: 'Clique no ícone de alfinete para fixar ou desafixar.',
      },
      {
        targetSelector: '.btn-tutorials-help',
        route: '/dashboard',
        title: 'Central de Apoio & Trilha Concluída!',
        description: 'Parabéns, você conheceu todas as áreas da plataforma! Sempre que tiver dúvidas, clique neste ícone no canto superior para iniciar tours específicos, abrir a solicitação assistida ou rever a Central de Tutoriais.',
        badge: 'Ajuda Sempre Disponível',
        icon: 'school',
        position: 'bottom',
        actionHint: 'Você pode refazer este tour a qualquer momento pelo menu de ajuda do topo.',
      },
    ],
    'criar-solicitacao': [
      {
        targetSelector: '[data-tour="btn-new-request"]',
        route: '/solicitacoes',
        title: '1. Iniciar Nova Solicitação',
        description: 'Para iniciar uma nova despesa ou compra corporativa, clique no botão destacado "Nova Solicitação".',
        badge: 'Abertura',
        icon: 'add_circle',
        position: 'bottom',
        actionHint: '👉 Clique no botão destacado ou em "Próximo" para abrir o formulário.',
      },
      {
        targetSelector: '[data-tour="solicitacao-titulo"]',
        route: '/solicitacoes/nova',
        title: '2. Título & Objeto da Demanda',
        description: 'Informe o que está sendo contratado de forma clara e resumida (ex: "Licenças de Software Cloud" ou "Notebooks para Novos Colaboradores").',
        badge: 'Identificação',
        icon: 'title',
        position: 'bottom',
        actionHint: 'Um título objetivo facilita a triagem e agiliza a aprovação da gerência.',
      },
      {
        targetSelector: '[data-tour="solicitacao-classificacao"]',
        route: '/solicitacoes/nova',
        title: '3. Centro de Custo & Categoria',
        description: 'Selecione qual centro de custo arcará com a despesa e a categoria contábil correspondente (ex: TI, Marketing, Treinamentos). O saldo orçamentário é checado em tempo real.',
        badge: 'Classificação',
        icon: 'category',
        position: 'bottom',
        actionHint: 'Centros de custo respeitam os limites orçamentários anuais aprovados.',
      },
      {
        targetSelector: '[data-tour="solicitacao-justificativa"]',
        route: '/solicitacoes/nova',
        title: '4. Justificativa de Governança',
        description: 'Descreva a necessidade da despesa e os benefícios para a operação (mínimo de 30 caracteres). Esta justificativa recebe carimbo de data/hora e hash criptográfico SHA-256.',
        badge: 'Compliance & SoD',
        icon: 'description',
        position: 'bottom',
        actionHint: 'Garante conformidade com as diretrizes de governança corporativa.',
      },
      {
        targetSelector: '[data-tour="solicitacao-valor"]',
        route: '/solicitacoes/nova',
        title: '5. Valor Total Previsto',
        description: 'Digite o montante estimado em Reais (R$). Conforme você digita o valor, o motor de regras recalcula imediatamente a esteira de deliberação.',
        badge: 'Financeiro',
        icon: 'payments',
        position: 'left',
        actionHint: 'Experimente testar valores: até R$ 10 mil (gerente), acima de R$ 50 mil (diretor/CFO).',
      },
      {
        targetSelector: '[data-tour="solicitacao-esteira"]',
        route: '/solicitacoes/nova',
        title: '6. Esteira de Alçada Dinâmica',
        description: 'Esta coluna exibe os aprovadores requeridos para a solicitação (ex: Gestor de Área ➔ Diretor ➔ CFO), respeitando a Segregação de Funções (SoD).',
        badge: 'Esteira de Decisão',
        icon: 'account_tree',
        position: 'left',
        actionHint: 'Cada gestor receberá notificações automáticas com prazos de SLA.',
      },
      {
        targetSelector: '[data-tour="solicitacao-submeter"]',
        route: '/solicitacoes/nova',
        title: '7. Submissão à Esteira',
        description: 'Tudo pronto! Ao clicar em "Submeter para Aprovação", seu pedido entra na fila de deliberação e você pode acompanhar os pareceres em tempo real.',
        badge: 'Finalização',
        icon: 'send',
        position: 'top',
        actionHint: 'Parabéns! Você completou a trilha prática de criação de solicitação.',
      },
    ],
    dashboard: [
      {
        targetSelector: 'app-page-header',
        route: '/dashboard',
        title: 'Centro de Operações (Dashboard)',
        description: 'Painel de comando executivo. Aqui você acompanha a saúde financeira e o fluxo de aprovações da sua organização em tempo real.',
        badge: 'Visão Geral',
        icon: 'dashboard',
        position: 'bottom',
        actionHint: 'Observe os alertas de prazo e notificações de auditoria no topo.',
      },
      {
        targetSelector: '.dashboard-kpis-grid',
        route: '/dashboard',
        title: 'Indicadores Principais (KPIs)',
        description: 'Quatro métricas essenciais: orçamento comprometido vs. teto, quantidade de solicitações na fila, pedidos liberados e integridade criptográfica SHA-256.',
        badge: 'Métricas Rápidas',
        icon: 'payments',
        position: 'bottom',
        actionHint: 'Clique no card de pendências para ir direto à fila de aprovação.',
      },
      {
        targetSelector: '.chart-main-column',
        route: '/dashboard',
        title: 'Tendência Financeira de Solicitações',
        description: 'Gráfico interativo de barras comparando a volumetria histórica de pedidos com a linha de média orçamentária aceita pela governança corporativa.',
        badge: 'Gráfico Analítico',
        icon: 'bar_chart',
        position: 'right',
        actionHint: 'Passe o mouse sobre as barras para inspecionar os montantes diários.',
      },
      {
        targetSelector: '.usage-card',
        route: '/dashboard',
        title: 'Consumo por Centro de Custo',
        description: 'Detalhamento do consumo de orçamento por departamento (TI, Marketing, RH, etc.), permitindo identificar áreas próximas do limite.',
        badge: 'Dotação Orçamentária',
        icon: 'pie_chart',
        position: 'left',
        actionHint: 'Alterne a visualização entre Dia, Semana e Mês.',
      },
    ],
    solicitacoes: [
      {
        targetSelector: 'app-page-header',
        route: '/solicitacoes',
        title: 'Central de Solicitações de Compra & Despesa',
        description: 'Aqui você gerencia todos os pedidos da sua empresa: compras de materiais, contratação de serviços corporativos e reembolsos de despesas.',
        badge: 'Compras & Despesas',
        icon: 'receipt_long',
        position: 'bottom',
        actionHint: 'O cabeçalho indica o total de pedidos e quantos estão em tramitação ativa.',
      },
      {
        targetSelector: '.toolbar-section .filter-dropdowns',
        route: '/solicitacoes',
        title: 'Filtros Rápidos & Busca Avançada',
        description: 'Filtre suas solicitações por Categoria de Despesa, Centro de Custo debitado ou ordene por data de criação e maior valor monetário.',
        badge: 'Filtros Dinâmicos',
        icon: 'filter_alt',
        position: 'bottom',
        actionHint: 'Use a busca para encontrar pedidos pelo código (#PED) ou fornecedor.',
      },
      {
        targetSelector: '.table-actions-strip',
        route: '/solicitacoes',
        title: 'Nova Solicitação & Exportação CSV',
        description: 'Gere relatórios CSV para auditoria ou clique em "Nova Solicitação" para abrir um pedido anexando cotações e justificativa.',
        badge: 'Ações Principais',
        icon: 'add_circle',
        position: 'bottom',
        actionHint: 'O formulário valida se o centro de custo tem saldo orçamentário.',
      },
      {
        targetSelector: '.table-container-card',
        route: '/solicitacoes',
        title: 'Tabela de Acompanhamento da Esteira',
        description: 'Acompanhe o status em tempo real (Rascunho, Pendente na Alçada, Aprovado, Ajuste Solicitado), quem é o aprovador atual e o código único.',
        badge: 'Esteira Ativa',
        icon: 'table_rows',
        position: 'top',
        actionHint: 'Pedidos com ajuste solicitado retornam diretamente para sua correção.',
      },
      {
        targetSelector: '.requests-table',
        route: '/solicitacoes',
        title: 'Drawer Lateral de Detalhes & Auditoria',
        description: 'Clique em qualquer linha da tabela para abrir o painel lateral com a íntegra da justificativa, documentos anexados e a linha do tempo da deliberação.',
        badge: 'Transparência & Histórico',
        icon: 'description',
        position: 'top',
        actionHint: 'Você pode baixar notas fiscais e propostas comerciais anexadas.',
      },
    ],
    aprovacoes: [
      {
        targetSelector: 'app-page-header',
        route: '/aprovacoes',
        title: 'Fila de Minhas Aprovações',
        description: 'Sua mesa de deliberações. Aqui aparecem todas as solicitações que requerem sua deliberação formal, baseadas no valor e no seu departamento.',
        badge: 'Deliberação Executiva',
        icon: 'how_to_reg',
        position: 'bottom',
        actionHint: 'O subtítulo mostra a quantidade de pedidos e o montante em R$ retido na esteira.',
      },
      {
        targetSelector: '.toolbar-section .filter-dropdowns',
        route: '/aprovacoes',
        title: 'Filtros Especializados & Ordenação',
        description: 'Filtre requisições por Departamento (TI, RH, Financeiro), Categoria de despesa ou Centro de Custo. Ordene por maior valor monetário para priorizar despesas críticas.',
        badge: 'Filtros Dinâmicos',
        icon: 'filter_alt',
        position: 'bottom',
        actionHint: 'Priorize os pedidos de maior impacto orçamentário.',
      },
      {
        targetSelector: '.table-actions-strip',
        route: '/aprovacoes',
        title: 'Aprovação em Lote & Exportação',
        description: 'Selecione múltiplos pedidos na tabela e clique em "Aprovar em Lote" para deliberar todos de uma só vez, gerando assinaturas digitais com agilidade.',
        badge: 'Eficiência com Segurança',
        icon: 'done_all',
        position: 'bottom',
        actionHint: 'Exporte relatórios em CSV para conciliação contábil.',
      },
      {
        targetSelector: '.table-container-card',
        route: '/aprovacoes',
        title: 'Análise da Solicitação & Alçadas',
        description: 'Cada linha detalha o solicitante, centro de custo debitado, montante em R$, finalidade e a etapa atual na esteira de alçadas da empresa.',
        badge: 'Visão da Esteira',
        icon: 'table_rows',
        position: 'top',
        actionHint: 'Clique na linha para inspecionar cotações e orçamentos anexados.',
      },
      {
        targetSelector: '.requests-table',
        route: '/aprovacoes',
        title: 'Assinatura SHA-256 e Conformidade SoD',
        description: 'Você pode Aprovar, Rejeitar ou Solicitar Ajuste. Cada deliberação gera uma assinatura criptográfica com hash SHA-256. O sistema bloqueia a aprovação de pedidos próprios (SoD).',
        badge: 'Governança & SoD',
        icon: 'verified_user',
        position: 'top',
        actionHint: 'Segurança e conformidade total para auditorias externas.',
      },
    ],
    'meus-fluxos': [
      {
        targetSelector: 'app-page-header',
        route: '/alcadas/minhas-alcadas',
        title: 'Gestor de Fluxos de Alçadas',
        description: 'Configure os caminhos estruturados que um pedido percorre desde o envio até a autorização de pagamento na sua organização.',
        badge: 'Esteiras de Decisão',
        icon: 'account_tree',
        position: 'bottom',
        actionHint: 'Acompanhe quantas esteiras ativas operam na organização.',
      },
      {
        targetSelector: '.toolbar-section',
        route: '/alcadas/minhas-alcadas',
        title: 'Busca, Catálogo de Regras & Nova Alçada',
        description: 'Localize esteiras por departamento ou clique em "Nova Alçada" para desenhar uma esteira customizada com múltiplos níveis de aprovação.',
        badge: 'Configuração',
        icon: 'add_task',
        position: 'bottom',
        actionHint: 'Você também pode alternar diretamente para o Catálogo de Regras.',
      },
      {
        targetSelector: '.rules-list-section, .limit-card',
        route: '/alcadas/minhas-alcadas',
        title: 'Parâmetros Estruturais & Tetos Financeiros',
        description: 'Cada card consolida o teto financeiro máximo (ex: R$ 50.000), o quórum de deliberação (unânime ou por maioria), o SLA máximo em horas e o centro de custo vinculado.',
        badge: 'Tetos Orçamentários',
        icon: 'payments',
        position: 'top',
        actionHint: 'Observe o código identificador único #ALC de cada fluxo.',
      },
      {
        targetSelector: '.card-pipeline-row, .pipeline-stepper',
        route: '/alcadas/minhas-alcadas',
        title: 'Visualização da Esteira de Aprovação',
        description: 'O stepper horizontal ilustra as fases sequenciais ou paralelas (ex: Gerente de Área ➔ Diretor Financeiro ➔ CFO/CEO). Cada nó indica se está ativo, aprovado ou pendente.',
        badge: 'Fluxo Visual',
        icon: 'linear_scale',
        position: 'top',
        actionHint: 'Entenda claramente o caminho que cada pedido irá percorrer.',
      },
      {
        targetSelector: '.btn-dots, .header-right',
        route: '/alcadas/minhas-alcadas',
        title: 'Editor no Canvas & Duplicação',
        description: 'No menu de opções (...) você pode abrir o editor visual em canvas para desenhar nós e condições de aprovação, duplicar regras existentes ou arquivar esteiras.',
        badge: 'Editor & Ações',
        icon: 'tune',
        position: 'left',
        actionHint: 'O editor visual permite conectar aprovadores por arrastar e soltar.',
      },
    ],
    'minhas-regras': [
      {
        targetSelector: 'app-page-header',
        route: '/alcadas/regras',
        title: 'Catálogo de Regras de Governança',
        description: 'Gerencie as políticas de limite que alimentam automaticamente as esteiras da empresa. Define regras por faixa de valor, cargo e departamento.',
        badge: 'Políticas de Alçada',
        icon: 'rule',
        position: 'bottom',
        actionHint: 'Acompanhe quantas regras estão cadastradas e quantas estão ativas em produção.',
      },
      {
        targetSelector: '.catalog-subtabs-nav',
        route: '/alcadas/regras',
        title: 'Regras Cadastradas vs. Modelos Predefinidos',
        description: 'Navegue entre as regras atualmente em vigor ou consulte modelos predefinidos de governança recomendados para o seu segmento corporativo.',
        badge: 'Navegação em Abas',
        icon: 'tab',
        position: 'bottom',
        actionHint: 'Modelos predefinidos aceleram a criação de novas alçadas.',
      },
      {
        targetSelector: '.list-toolbar-row',
        route: '/alcadas/regras',
        title: 'Filtro de Ativas & Criação de Regra',
        description: 'Utilize o interruptor para visualizar somente regras ativas, pesquise por termo ou clique em "+ Nova Regra" para parametrizar um novo limite.',
        badge: 'Filtros & Criação',
        icon: 'toggle_on',
        position: 'bottom',
        actionHint: 'Mantenha sua matriz de alçadas sempre atualizada.',
      },
      {
        targetSelector: '.rules-table-container',
        route: '/alcadas/regras',
        title: 'Tabela de Políticas, Escopos e Ações',
        description: 'Exibe o nome da regra, tipo (Aprovação por Faixa, Substituição por Férias, Bloqueio Automático), o departamento aplicável e ações de parametrização.',
        badge: 'Matriz de Governança',
        icon: 'table_chart',
        position: 'top',
        actionHint: 'Configure regras de substitutos automáticos para ausências de gestores.',
      },
    ],
    organizacao: [
      {
        targetSelector: '.page-header-tier1, .settings-identity-header',
        route: '/configuracoes/organizacao',
        title: 'Quadro da Organização & Empresa',
        description: 'Gerencie os pilares cadastrais da sua empresa: dados corporativos, departamentos com centros de custo e colaboradores.',
        badge: 'Governança Corporativa',
        icon: 'domain',
        position: 'bottom',
      },
      {
        targetSelector: '.settings-tabs-nav',
        route: '/configuracoes/organizacao',
        title: 'Abas Organizacionais',
        description: 'Navegue entre "Dados da Empresa", "Departamentos & Centros de Custo", "Funcionários & Alçadas" e "Políticas de Projeto".',
        badge: 'Navegação em Abas',
        icon: 'tab',
        position: 'bottom',
      },
      {
        targetSelector: '.org-items-list',
        route: '/configuracoes/organizacao',
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
    void this.startTour('onboarding');
  }

  startTourForCurrentRoute(): void {
    const url = this.router.url;
    if (url.includes('/solicitacoes/nova')) this.startTour('criar-solicitacao');
    else if (url.includes('/aprovacoes')) this.startTour('aprovacoes');
    else if (url.includes('/solicitacoes')) this.startTour('solicitacoes');
    else if (url.includes('/alcadas/regras')) this.startTour('minhas-regras');
    else if (url.includes('/alcadas')) this.startTour('meus-fluxos');
    else if (url.includes('/configuracoes/organizacao') || url.includes('/organizacao')) this.startTour('organizacao');
    else if (url.includes('/dashboard')) this.startTour('dashboard');
    else this.startTour('onboarding');
  }

  private async safeNavigate(route?: string): Promise<void> {
    if (!route || typeof window === 'undefined') return;
    try {
      if (!this.router.url.startsWith(route)) {
        await this.router.navigateByUrl(route);
      }
    } catch {
      // Ignora erro de rota não registrada em testes ou restrições de navegação
    }
  }

  startTour(contextKey = 'onboarding'): void {
    const steps = this.toursCatalog[contextKey] || this.toursCatalog['onboarding'] || this.toursCatalog['dashboard'];
    this.currentContext.set(contextKey);
    this.tourSteps.set(steps);
    this.currentStepIndex.set(0);
    this.isTourActive.set(true);

    const firstStep = steps[0];
    void this.safeNavigate(firstStep?.route);

    this.scrollToActiveTarget();
  }

  nextStep(): void {
    const nextIdx = this.currentStepIndex() + 1;
    const steps = this.tourSteps();
    if (nextIdx < steps.length) {
      const nextStep = steps[nextIdx];
      this.currentStepIndex.set(nextIdx);
      void this.safeNavigate(nextStep?.route);
      this.scrollToActiveTarget();
    } else {
      this.endTour();
    }
  }

  prevStep(): void {
    const prevIdx = this.currentStepIndex() - 1;
    const steps = this.tourSteps();
    if (prevIdx >= 0) {
      const prevStep = steps[prevIdx];
      this.currentStepIndex.set(prevIdx);
      void this.safeNavigate(prevStep?.route);
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
