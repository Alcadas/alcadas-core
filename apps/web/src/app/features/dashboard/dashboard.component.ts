import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import {
  RequestBarChartComponent,
  RequestChartDataPoint,
} from './components/request-bar-chart/request-bar-chart.component';
import { RequestsService } from '../requests/services/requests.service';
import { SettingsService } from '../settings/services/settings.service';
import { LimitsService } from '../limits/services/limits.service';

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
  imports: [CommonModule, PageHeaderComponent, RequestBarChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected readonly authService = inject(AuthService);
  protected readonly requestsService = inject(RequestsService);
  protected readonly settingsService = inject(SettingsService);
  protected readonly limitsService = inject(LimitsService);
  private readonly router = inject(Router);

  goToNewRequest(): void {
    this.router.navigate(['/solicitacoes/nova']);
  }

  // Dados para o Gráfico Shadcn de Valores por Solicitação sincronizado com o Backend/Firestore
  readonly chartRequests = computed<RequestChartDataPoint[]>(() => {
    const reqs = this.requestsService.requests();
    if (reqs.length === 0) return [];
    return reqs.slice(0, 8).map((r) => ({
      id: r.id,
      code: r.codigo.replace('#', ''),
      title: r.titulo || r.descricao,
      department: r.centroCustoNome || r.departamento,
      deptCode: (r.departamento || r.centroCustoNome || 'GER').slice(0, 3).toUpperCase(),
      value: r.valor,
      requester: r.solicitante.nome,
      date: r.dataCriacao.slice(0, 10),
    }));
  });

  // Estado de Carregamento dos Dados do Dashboard
  readonly isLoading = signal(false);

  readonly selectedPeriod = signal<'dia' | 'semana' | 'mes'>('mes');
  readonly selectedTab = signal<'pendentes' | 'todas' | 'aprovadas'>('pendentes');
  readonly searchQuery = signal('');

  readonly quickCards = computed<QuickActionCard[]>(() => {
    const stats = this.requestsService.stats();
    const flowsCount = this.limitsService.filteredRules().length;
    const depts = this.settingsService.organization().departments;
    const maxDeptCeiling = depts.reduce((max, d) => (d.monthlyBudget > max ? d.monthlyBudget : max), 50000);
    const maxCeilingFormatted = `Até R$ ${Math.round(maxDeptCeiling / 1000)}k`;

    return [
      {
        id: 'aprovacoes',
        title: 'Aprovações Pendentes',
        description: `${stats.pendentes} pedido(s) exigem assinatura para liberação de empenho na organização.`,
        icon: 'check-circle',
        tag: `${stats.pendentes} Pendente(s)`,
        tagColor: stats.pendentes > 0 ? '#dc2626' : '#10B981',
      },
      {
        id: 'tetos',
        title: 'Fluxos & Alçadas',
        description: `${flowsCount} esteiras ativas sincronizadas com os departamentos da empresa.`,
        icon: 'shield',
        tag: maxCeilingFormatted,
        tagColor: '#644EF3',
      },
      {
        id: 'riscos',
        title: 'Prevenção de Fraudes',
        description: 'Motor anti-fracionamento monitorando janela móvel de 30 dias no Firestore.',
        icon: 'radar',
        tag: `${stats.rejeitadas} Bloqueio(s)`,
        tagColor: '#10B981',
      },
      {
        id: 'auditoria',
        title: 'Trilha Criptográfica',
        description: 'Cadeia de elos imutáveis com hashes SHA-256 encadeados por solicitação.',
        icon: 'hash',
        tag: `${stats.total} Elo(s)`,
        tagColor: '#059669',
      },
    ];
  });

  readonly totalBudget = computed(() => {
    const depts = this.settingsService.organization().departments;
    const sum = depts.reduce((acc, d) => acc + (d.monthlyBudget || 0), 0);
    return sum > 0 ? sum : 600000;
  });

  readonly usedBudget = computed(() => {
    const reqs = this.requestsService.requests();
    const sum = reqs
      .filter((r) => r.status !== 'REJEITADA')
      .reduce((acc, r) => acc + r.valor, 0);
    return sum;
  });

  readonly budgetPercentage = computed(() => {
    const total = this.totalBudget();
    if (!total) return 0;
    return Math.min(100, Number(((this.usedBudget() / total) * 100).toFixed(1)));
  });

  readonly budgetSegments = computed<BudgetSegment[]>(() => {
    const depts = this.settingsService.organization().departments;
    const reqs = this.requestsService
      .requests()
      .filter((r) => r.status !== 'REJEITADA');
    const colors = ['#644EF3', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9'];
    const totalUsed = this.usedBudget() || 1;

    return depts.map((dept, index) => {
      const deptReqs = reqs.filter(
        (r) =>
          r.centroCustoId === dept.id ||
          r.centroCustoNome.toLowerCase().includes(dept.name.toLowerCase()) ||
          r.departamento.toLowerCase().includes(dept.name.toLowerCase())
      );
      const val = deptReqs.reduce((acc, r) => acc + r.valor, 0);
      const pct = Number(((val / totalUsed) * 100).toFixed(1));
      return {
        name: dept.name,
        valueFormatted: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          maximumFractionDigits: 0,
        }).format(val),
        value: val,
        percentage: pct > 0 ? pct : Number((100 / Math.max(depts.length, 1)).toFixed(1)),
        color: colors[index % colors.length],
        departmentCode: dept.code,
      };
    });
  });

  readonly requests = computed<ApprovalRequest[]>(() => {
    return this.requestsService.requests().map((r) => ({
      id: r.id,
      code: r.codigo,
      description: r.titulo || r.descricao,
      category: r.categoriaLabel,
      department: r.centroCustoNome || r.departamento,
      deptCode: (r.departamento || r.centroCustoNome || 'GER').slice(0, 3).toUpperCase(),
      deptColor: r.categoriaColor || '#644EF3',
      author: r.solicitante.nome,
      value: r.valor,
      valueFormatted: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.valor),
      requiredTier: r.fluxoDestinado.nome,
      status:
        r.status === 'APROVADA'
          ? ('APROVADA' as const)
          : r.status === 'PENDENTE'
          ? ('PENDENTE' as const)
          : ('EM_AJUSTE' as const),
      date: r.dataCriacao.slice(0, 10),
    }));
  });

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
    this.requestsService.approveRequest(
      req.id,
      undefined,
      'Aprovado via Dashboard',
      this.authService.currentUser()?.name || 'Aprovador',
    );
  }

  setPeriod(period: 'dia' | 'semana' | 'mes'): void {
    this.selectedPeriod.set(period);
  }

  setTab(tab: 'pendentes' | 'todas' | 'aprovadas'): void {
    this.selectedTab.set(tab);
  }

  constructor() {
    this.settingsService.carregarOuSincronizarTenantsComBackend();
    this.requestsService.ensureLoaded();
    this.limitsService.loadFromBackend();
  }
}
