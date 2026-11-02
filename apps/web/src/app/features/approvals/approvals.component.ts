import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PageHeaderComponent,
  PageHeaderTab,
} from '../../shared/components/page-header/page-header.component';
import { RightDrawerComponent } from '../../shared/components/right-drawer/right-drawer.component';
import {
  DigitalSignatureModalComponent,
  SignatureConfirmation,
} from './components/digital-signature-modal/digital-signature-modal.component';
import { RequestsService } from '../requests/services/requests.service';
import { RequestItem, RequestPriority, RequestStatus } from '../requests/requests.models';

export type ApprovalsTab = 'pendentes' | 'ajustes' | 'aprovadas' | 'todas';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    RightDrawerComponent,
    DigitalSignatureModalComponent,
  ],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss',
})
export class ApprovalsComponent {
  readonly requestsService = inject(RequestsService);

  // Filtros e Navegação
  readonly currentTab = signal<ApprovalsTab>('pendentes');
  readonly searchQuery = signal<string>('');
  readonly selectedDepartment = signal<string>('TODOS');
  readonly selectedCategory = signal<string>('TODAS');
  readonly selectedCostCenter = signal<string>('TODOS');
  readonly selectedPriority = signal<string>('TODAS');
  readonly sortBy = signal<'recentes' | 'maior_valor' | 'menor_valor' | 'prioridade'>('recentes');
  readonly showKpis = signal<boolean>(true);

  // Seleção e Paginação
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  // Inspeção no Drawer
  readonly selectedRequest = signal<RequestItem | null>(null);
  readonly isDetailDrawerOpen = signal<boolean>(false);

  // Modal de Assinatura Digital
  readonly signingRequest = signal<RequestItem | null>(null);
  readonly isSignModalOpen = signal<boolean>(false);
  readonly isBatchSignMode = signal<boolean>(false);

  // Modal de Validação Técnica
  readonly validatingRequest = signal<RequestItem | null>(null);
  readonly validationNote = signal<string>(
    'Conformidade técnica e orçamentária atestada em conformidade com o regimento interno de governança.'
  );

  // Modal de Ajuste / Revisão
  readonly adjustingRequest = signal<RequestItem | null>(null);
  readonly adjustmentReason = signal<string>('');

  // Modal de Rejeição / Negativa
  readonly rejectingRequest = signal<RequestItem | null>(null);
  readonly rejectionReason = signal<string>('');

  // Notificações Toast
  readonly toast = signal<{
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
  } | null>(null);

  // Alçada do gestor autenticado
  readonly authorizedLimit = 50000;

  // Abas do PageHeader
  readonly headerTabs = computed<PageHeaderTab[]>(() => {
    return [
      {
        id: 'pendentes',
        label: 'Para Deliberar',
        icon: 'hourglass_top',
        badge: this.pendingCount(),
        badgeVariant: 'warning',
      },
      {
        id: 'ajustes',
        label: 'Em Revisão',
        icon: 'edit_note',
        badge: this.adjustmentCount(),
        badgeVariant: this.adjustmentCount() > 0 ? 'warning' : 'neutral',
      },
      {
        id: 'aprovadas',
        label: 'Aprovadas',
        icon: 'verified',
        badge: this.approvedCount(),
        badgeVariant: 'success',
      },
      {
        id: 'todas',
        label: 'Todas',
        icon: 'list_alt',
        badge: this.requestsService.requests().length,
        badgeVariant: 'neutral',
      },
    ];
  });

  // Departamentos disponíveis para filtro
  readonly departments = computed(() => {
    const list = this.requestsService.requests();
    const depts = new Set<string>();
    list.forEach((req) => depts.add(req.departamento));
    return Array.from(depts).sort();
  });

  // Métricas para os quick-cards
  readonly pendingCount = computed(() => {
    return this.requestsService.requests().filter((r) => r.status === 'PENDENTE').length;
  });

  readonly pendingTotalValue = computed(() => {
    return this.requestsService
      .requests()
      .filter((r) => r.status === 'PENDENTE')
      .reduce((sum, r) => sum + r.valor, 0);
  });

  readonly adjustmentCount = computed(() => {
    return this.requestsService.requests().filter((r) => r.status === 'AJUSTE_SOLICITADO').length;
  });

  readonly approvedCount = computed(() => {
    return this.requestsService.requests().filter((r) => r.status === 'APROVADA').length;
  });

  readonly totalDeliberationsCount = computed(() => {
    return this.requestsService
      .requests()
      .filter((r) => r.status === 'APROVADA' || r.status === 'REJEITADA').length;
  });

  readonly approvalRate = computed(() => {
    const totalDone = this.totalDeliberationsCount();
    if (totalDone === 0) return 0;
    return Math.round((this.approvedCount() / totalDone) * 100);
  });

  readonly pendingPercent = computed(() => {
    const total = this.requestsService.requests().length;
    if (total === 0) return 0;
    return Math.round((this.pendingCount() / total) * 100);
  });

  // Lista filtrada e ordenada de aprovações
  readonly filteredRequests = computed<RequestItem[]>(() => {
    let list = [...this.requestsService.requests()];
    const tab = this.currentTab();
    const query = this.searchQuery().trim().toLowerCase();
    const dept = this.selectedDepartment();
    const cat = this.selectedCategory();
    const cc = this.selectedCostCenter();
    const prio = this.selectedPriority();
    const sort = this.sortBy();

    // Filtro por Tab
    if (tab === 'pendentes') {
      list = list.filter((r) => r.status === 'PENDENTE');
    } else if (tab === 'ajustes') {
      list = list.filter((r) => r.status === 'AJUSTE_SOLICITADO');
    } else if (tab === 'aprovadas') {
      list = list.filter((r) => r.status === 'APROVADA');
    }

    // Filtro por Departamento
    if (dept !== 'TODOS') {
      list = list.filter((r) => r.departamento === dept);
    }

    // Filtro por Categoria
    if (cat !== 'TODAS') {
      list = list.filter((r) => r.categoria === cat);
    }

    // Filtro por Centro de Custo
    if (cc !== 'TODOS') {
      list = list.filter((r) => r.centroCustoId === cc);
    }

    // Filtro por Prioridade
    if (prio !== 'TODAS') {
      list = list.filter((r) => r.prioridade === prio);
    }

    // Filtro por Busca Textual
    if (query) {
      list = list.filter(
        (r) =>
          r.codigo.toLowerCase().includes(query) ||
          r.titulo.toLowerCase().includes(query) ||
          r.solicitante.nome.toLowerCase().includes(query) ||
          r.solicitante.cargo.toLowerCase().includes(query) ||
          r.departamento.toLowerCase().includes(query) ||
          r.centroCustoNome.toLowerCase().includes(query)
      );
    }

    // Ordenação
    if (sort === 'maior_valor') {
      list.sort((a, b) => b.valor - a.valor);
    } else if (sort === 'menor_valor') {
      list.sort((a, b) => a.valor - b.valor);
    } else if (sort === 'prioridade') {
      const pWeights: Record<RequestPriority, number> = {
        CRITICA: 4,
        ALTA: 3,
        MEDIA: 2,
        BAIXA: 1,
      };
      list.sort((a, b) => pWeights[b.prioridade] - pWeights[a.prioridade]);
    } else {
      // Recentes (dataCriacao decrescente)
      list.sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime());
    }

    return list;
  });

  // Lista paginada
  readonly paginatedRequests = computed<RequestItem[]>(() => {
    const list = this.filteredRequests();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  readonly totalPages = computed<number>(() => {
    const total = this.filteredRequests().length;
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  // Seleção em lote
  readonly selectedItems = computed(() => {
    const ids = this.selectedIds();
    return this.requestsService.requests().filter((r) => ids.has(r.id));
  });

  readonly selectedTotalValue = computed(() => {
    return this.selectedItems().reduce((sum, r) => sum + r.valor, 0);
  });

  readonly isAllSelected = computed(() => {
    const currentList = this.paginatedRequests();
    if (currentList.length === 0) return false;
    return currentList.every((r) => this.selectedIds().has(r.id));
  });

  // Compatibilidade com activeTab
  activeTab(): ApprovalsTab {
    return this.currentTab();
  }

  // Ações de Aba, Busca e Filtros
  setTab(tab: ApprovalsTab): void {
    this.currentTab.set(tab);
    this.currentPage.set(1);
    this.clearSelection();
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  setDepartmentFilter(dept: string): void {
    this.selectedDepartment.set(dept);
    this.currentPage.set(1);
  }

  setCategoryFilter(cat: string): void {
    this.selectedCategory.set(cat);
    this.currentPage.set(1);
  }

  setCostCenterFilter(cc: string): void {
    this.selectedCostCenter.set(cc);
    this.currentPage.set(1);
  }

  setPriorityFilter(prio: string): void {
    this.selectedPriority.set(prio);
    this.currentPage.set(1);
  }

  setSortBy(sort: 'recentes' | 'maior_valor' | 'menor_valor' | 'prioridade'): void {
    this.sortBy.set(sort);
  }

  toggleKpis(): void {
    this.showKpis.update((v) => !v);
  }

  // Ações de Paginação
  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  // Ações de Seleção
  toggleSelect(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  toggleSelectAll(): void {
    const currentList = this.paginatedRequests();
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      const next = new Set(this.selectedIds());
      currentList.forEach((r) => next.add(r.id));
      this.selectedIds.set(next);
    }
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  // Visualização no Drawer
  openDetailDrawer(req: RequestItem): void {
    this.selectedRequest.set(req);
    this.isDetailDrawerOpen.set(true);
  }

  closeDetailDrawer(): void {
    this.isDetailDrawerOpen.set(false);
  }

  // Fluxo de Assinatura Digital
  openSignModal(req: RequestItem): void {
    this.signingRequest.set(req);
    this.isBatchSignMode.set(false);
    this.isSignModalOpen.set(true);
  }

  openBatchSignModal(): void {
    if (this.selectedIds().size === 0) return;
    const firstSelected = this.selectedItems()[0] || null;
    this.signingRequest.set(firstSelected);
    this.isBatchSignMode.set(true);
    this.isSignModalOpen.set(true);
  }

  closeSignModal(): void {
    this.isSignModalOpen.set(false);
    this.signingRequest.set(null);
    this.isBatchSignMode.set(false);
  }

  onSignatureConfirmed(confirmation: SignatureConfirmation): void {
    if (this.isBatchSignMode()) {
      const ids = Array.from(this.selectedIds());
      const approvedCount = this.requestsService.approveBatch(ids, confirmation.signatureDataUrl);
      this.closeSignModal();
      this.clearSelection();
      this.triggerToast(
        'Aprovação em Lote Concluída',
        `${approvedCount} solicitações foram assinadas digitalmente e deliberadas com sucesso.`,
        'success'
      );
    } else {
      const req = this.signingRequest();
      if (!req) return;
      this.requestsService.approveRequest(
        req.id,
        confirmation.signatureDataUrl,
        confirmation.comentario
      );
      this.closeSignModal();
      this.triggerToast(
        'Solicitação Aprovada & Assinada',
        `A solicitação ${req.codigo} foi assinada digitalmente com certificação SHA-256.`,
        'success'
      );
    }
  }

  // Fluxo de Validação Técnica
  openValidateModal(req: RequestItem): void {
    this.validatingRequest.set(req);
    this.validationNote.set(
      'Conformidade técnica e orçamentária atestada em conformidade com o regimento interno de governança.'
    );
  }

  closeValidateModal(): void {
    this.validatingRequest.set(null);
  }

  confirmValidation(): void {
    const req = this.validatingRequest();
    if (!req) return;
    this.requestsService.validateRequest(req.id, this.validationNote().trim());
    this.closeValidateModal();
    this.triggerToast(
      'Validação Técnica Registrada',
      `O parecer de conformidade foi registrado na trilha de auditoria de ${req.codigo}.`,
      'info'
    );
  }

  // Fluxo de Solicitação de Ajuste / Revisão
  openAdjustmentModal(req: RequestItem): void {
    this.adjustingRequest.set(req);
    this.adjustmentReason.set('');
  }

  closeAdjustmentModal(): void {
    this.adjustingRequest.set(null);
  }

  confirmAdjustment(): void {
    const req = this.adjustingRequest();
    const reason = this.adjustmentReason().trim();
    if (!req || !reason) return;

    this.requestsService.requestAdjustment(req.id, reason, 'Comitê de Alçadas / Aprovador');
    this.closeAdjustmentModal();
    this.triggerToast(
      'Revisão Solicitada',
      `A solicitação ${req.codigo} foi devolvida ao solicitante para complementação das informações.`,
      'warning'
    );
  }

  // Fluxo de Rejeição / Recusa
  openRejectModal(req: RequestItem): void {
    this.rejectingRequest.set(req);
    this.rejectionReason.set('');
  }

  closeRejectModal(): void {
    this.rejectingRequest.set(null);
  }

  confirmRejection(): void {
    const req = this.rejectingRequest();
    const reason = this.rejectionReason().trim();
    if (!req || !reason) return;

    this.requestsService.rejectRequest(req.id, reason, 'Diretoria Executiva');
    this.closeRejectModal();
    this.triggerToast(
      'Solicitação Recusada',
      `A solicitação ${req.codigo} foi encerrada e rejeitada no fluxo de governança.`,
      'error'
    );
  }

  // Helpers visuais idênticos à tela de solicitações
  getStatusBadgeClass(status: RequestStatus): string {
    switch (status) {
      case 'APROVADA':
        return 'status-success';
      case 'PENDENTE':
        return 'status-warning';
      case 'AJUSTE_SOLICITADO':
        return 'status-adjust';
      case 'REJEITADA':
      case 'CANCELADA':
        return 'status-danger';
      default:
        return 'status-neutral';
    }
  }

  getPriorityBadgeClass(priority: RequestPriority): string {
    switch (priority) {
      case 'CRITICA':
        return 'priority-critical';
      case 'ALTA':
        return 'priority-high';
      case 'MEDIA':
        return 'priority-medium';
      case 'BAIXA':
        return 'priority-low';
    }
  }

  triggerToast(
    title: string,
    message: string,
    type: 'success' | 'warning' | 'error' | 'info'
  ): void {
    this.toast.set({ title, message, type });
    setTimeout(() => {
      this.toast.set(null);
    }, 4500);
  }
}
