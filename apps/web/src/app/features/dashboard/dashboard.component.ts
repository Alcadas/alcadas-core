import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

export interface QuickActionCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  tag?: string;
  tagColor?: string;
}

export interface BudgetSegment {
  name: string;
  valueFormatted: string;
  value: number;
  percentage: number;
  color: string;
  departmentCode: string;
}

export interface ApprovalRequest {
  id: string;
  code: string;
  description: string;
  category: string;
  department: string;
  deptCode: string;
  deptColor: string;
  author: string;
  value: number;
  valueFormatted: string;
  requiredTier: string;
  status: 'PENDENTE' | 'APROVADA' | 'EM_AJUSTE';
  date: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Estado de Carregamento dos Dados do Dashboard
  readonly isLoading = signal(true);

  readonly selectedPeriod = signal<'dia' | 'semana' | 'mes'>('mes');
  readonly selectedTab = signal<'pendentes' | 'todas' | 'aprovadas'>('pendentes');
  readonly searchQuery = signal('');

  readonly quickCards = signal<QuickActionCard[]>([
    {
      id: 'aprovacoes',
      title: 'Aprovações Pendentes',
      description: '3 pedidos exigem sua assinatura para liberação de empenho.',
      icon: 'check-circle',
      tag: '3 Críticas',
      tagColor: '#dc2626',
    },
    {
      id: 'tetos',
      title: 'Limites por Cargo',
      description: 'Alçadas configuradas: seu limite titular é até R$ 50.000/pedido.',
      icon: 'shield',
      tag: 'Até R$ 50k',
      tagColor: '#644EF3',
    },
    {
      id: 'riscos',
      title: 'Prevenção de Fraudes',
      description: 'Motor anti-fracionamento monitorando janela móvel de 30 dias.',
      icon: 'radar',
      tag: '0 Conflitos',
      tagColor: '#10B981',
    },
    {
      id: 'auditoria',
      title: 'Trilha Criptográfica',
      description: 'Cadeia de elos imutáveis com hashes SHA-256 encadeados.',
      icon: 'hash',
      tag: 'Elo #1.428',
      tagColor: '#059669',
    },
  ]);

  readonly budgetSegments = signal<BudgetSegment[]>([
    {
      name: 'Infraestrutura Cloud & SaaS',
      valueFormatted: 'R$ 168.400',
      value: 168400,
      percentage: 34.6,
      color: '#644EF3',
      departmentCode: 'TI',
    },
    {
      name: 'Serviços de Engenharia & Obra',
      valueFormatted: 'R$ 142.900',
      value: 142900,
      percentage: 29.3,
      color: '#8B5CF6',
      departmentCode: 'ENG',
    },
    {
      name: 'Consultoria Especializada',
      valueFormatted: 'R$ 96.500',
      value: 96500,
      percentage: 19.8,
      color: '#10B981',
      departmentCode: 'FIN',
    },
    {
      name: 'Materiais & Suprimentos',
      valueFormatted: 'R$ 79.500',
      value: 79500,
      percentage: 16.3,
      color: '#F59E0B',
      departmentCode: 'OP',
    },
  ]);

  readonly totalBudget = signal(600000);
  readonly usedBudget = signal(487300);

  readonly requests = signal<ApprovalRequest[]>([
    {
      id: '1',
      code: 'SOL-2024-104',
      description: 'Expansão de Clusters Kubernetes AWS',
      category: 'Infra Cloud',
      department: 'Tecnologia',
      deptCode: 'TI',
      deptColor: '#644EF3',
      author: 'Lucas Siqueira',
      value: 38500,
      valueFormatted: 'R$ 38.500,00',
      requiredTier: 'Gestor Titular',
      status: 'PENDENTE',
      date: 'Hoje, 14:32',
    },
    {
      id: '2',
      code: 'SOL-2024-103',
      description: 'Auditoria de Conformidade e Pentest',
      category: 'Consultoria',
      department: 'Controladoria',
      deptCode: 'FIN',
      deptColor: '#F59E0B',
      author: 'Mariana Duarte',
      value: 48900,
      valueFormatted: 'R$ 48.900,00',
      requiredTier: 'Gestor Titular',
      status: 'PENDENTE',
      date: 'Hoje, 11:15',
    },
    {
      id: '3',
      code: 'SOL-2024-102',
      description: 'Contratação de Sondagem de Terreno',
      category: 'Engenharia',
      department: 'Engenharia',
      deptCode: 'ENG',
      deptColor: '#10B981',
      author: 'Carlos Eduardo',
      value: 18200,
      valueFormatted: 'R$ 18.200,00',
      requiredTier: 'Coordenador N1',
      status: 'PENDENTE',
      date: 'Ontem, 16:40',
    },
    {
      id: '4',
      code: 'SOL-2024-098',
      description: 'Licenciamento de Softwares CAD/BIM',
      category: 'Engenharia',
      department: 'Arquitetura',
      deptCode: 'ARQ',
      deptColor: '#8B5CF6',
      author: 'Beatriz Lima',
      value: 29400,
      valueFormatted: 'R$ 29.400,00',
      requiredTier: 'Gestor Titular',
      status: 'APROVADA',
      date: '28 Out, 10:20',
    },
    {
      id: '5',
      code: 'SOL-2024-095',
      description: 'Renovação de Links de Fibra Óptica',
      category: 'Telecom',
      department: 'Operações',
      deptCode: 'OP',
      deptColor: '#EC4899',
      author: 'Roberto Alencar',
      value: 12500,
      valueFormatted: 'R$ 12.500,00',
      requiredTier: 'Coordenador N1',
      status: 'APROVADA',
      date: '27 Out, 15:10',
    },
  ]);

  readonly filteredRequests = computed(() => {
    const tab = this.selectedTab();
    const query = this.searchQuery().toLowerCase().trim();

    return this.requests().filter((req) => {
      const matchTab =
        tab === 'todas'
          ? true
          : tab === 'pendentes'
          ? req.status === 'PENDENTE'
          : req.status === 'APROVADA';

      const matchQuery =
        !query ||
        req.description.toLowerCase().includes(query) ||
        req.code.toLowerCase().includes(query) ||
        req.department.toLowerCase().includes(query);

      return matchTab && matchQuery;
    });
  });

  approveRequest(req: ApprovalRequest, event: Event): void {
    event.stopPropagation();
    this.requests.update((list) =>
      list.map((item) =>
        item.id === req.id ? { ...item, status: 'APROVADA' as const } : item
      )
    );
  }

  setPeriod(period: 'dia' | 'semana' | 'mes'): void {
    this.selectedPeriod.set(period);
  }

  setTab(tab: 'pendentes' | 'todas' | 'aprovadas'): void {
    this.selectedTab.set(tab);
  }

  constructor() {
    // Simula carregamento de métricas e limites da API
    setTimeout(() => {
      this.isLoading.set(false);
    }, 650);
  }
}
