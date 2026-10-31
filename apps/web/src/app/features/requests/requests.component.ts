import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RightDrawerComponent } from '../../shared/components/right-drawer/right-drawer.component';
import { PageHeaderComponent, PageHeaderTab } from '../../shared/components/page-header/page-header.component';
import { RequestsService } from './services/requests.service';
import {
  ApprovalStep,
  RequestCategory,
  RequestItem,
  RequestPriority,
  RequestStatus,
  WorkflowDestination,
} from './requests.models';

export type RequestTab = 'todas' | 'pendentes' | 'aprovadas' | 'ajustes' | 'rejeitadas';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RightDrawerComponent, PageHeaderComponent],
  templateUrl: './requests.component.html',
  styleUrl: './requests.component.scss',
})
export class RequestsComponent {
  protected readonly requestsService = inject(RequestsService);

  // Filtros e Navegação
  readonly currentTab = signal<RequestTab>('todas');
  readonly searchQuery = signal<string>('');
  readonly selectedCategory = signal<string>('TODAS');
  readonly selectedCostCenter = signal<string>('TODOS');
  readonly sortBy = signal<'recentes' | 'maior_valor' | 'menor_valor' | 'prioridade'>('recentes');
  readonly viewMode = signal<'cards' | 'table'>('cards');
  readonly showKpis = signal<boolean>(true);

  // Abas do PageHeader
  readonly headerTabs = computed<PageHeaderTab[]>(() => {
    const s = this.requestsService.stats();
    return [
      { id: 'todas', label: 'Todas', icon: 'apps', badge: s.total },
      { id: 'pendentes', label: 'Em Análise', icon: 'hourglass_top', badge: s.pendentes, badgeVariant: 'warning' },
      { id: 'aprovadas', label: 'Aprovadas', icon: 'verified', badge: s.aprovadas, badgeVariant: 'success' },
      { id: 'ajustes', label: 'Ajustes', icon: 'edit_note', badge: s.ajustes, badgeVariant: 'adjust' },
      { id: 'rejeitadas', label: 'Recusadas', icon: 'cancel', badge: s.rejeitadas, badgeVariant: 'danger' },
    ];
  });

  // Seleção e Paginação
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  // Drawers Laterais
  readonly isCreateDrawerOpen = signal<boolean>(false);
  readonly isDetailDrawerOpen = signal<boolean>(false);
  readonly selectedRequest = signal<RequestItem | null>(null);

  // Feedback Toast
  readonly toastMessage = signal<string | null>(null);
  readonly toastType = signal<'success' | 'warning' | 'info'>('success');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Estado do Formulário de Criação
  readonly isSubmitting = signal<boolean>(false);
  readonly formTitulo = signal<string>('');
  readonly formCategoria = signal<RequestCategory>('EQUIPAMENTOS_TI');
  readonly formCentroCustoId = signal<string>('cc-ti');
  readonly formValor = signal<number | null>(null);
  readonly formPrioridade = signal<RequestPriority>('MEDIA');
  readonly formJustificativa = signal<string>('');
  readonly formAnexos = signal<Array<{ nome: string; tamanho: string; tipo: string }>>([
    { nome: 'Cotacao_Oficial_Fornecedor.pdf', tamanho: '1.1 MB', tipo: 'application/pdf' },
  ]);
  readonly formErrors = signal<Record<string, string>>({});

  // Estatísticas globais do serviço
  readonly stats = this.requestsService.stats;

  // Fluxo de aprovação estimado em tempo real para o formulário
  readonly suggestedWorkflow = computed<WorkflowDestination>(() => {
    const valor = this.formValor() || 0;
    const ccId = this.formCentroCustoId();
    const cat = this.formCategoria();
    return this.requestsService.calculateSuggestedWorkflow(valor, ccId, cat);
  });

  // Lista filtrada e ordenada de solicitações
  readonly filteredRequests = computed<RequestItem[]>(() => {
    let list = [...this.requestsService.requests()];
    const tab = this.currentTab();
    const query = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();
    const cc = this.selectedCostCenter();
    const sort = this.sortBy();

    // Filtro por Tab
    if (tab === 'pendentes') {
      list = list.filter((r) => r.status === 'PENDENTE');
    } else if (tab === 'aprovadas') {
      list = list.filter((r) => r.status === 'APROVADA');
    } else if (tab === 'ajustes') {
      list = list.filter((r) => r.status === 'AJUSTE_SOLICITADO');
    } else if (tab === 'rejeitadas') {
      list = list.filter((r) => r.status === 'REJEITADA');
    }

    // Filtro por Busca Textual
    if (query) {
      list = list.filter(
        (r) =>
          r.codigo.toLowerCase().includes(query) ||
          r.titulo.toLowerCase().includes(query) ||
          r.centroCustoNome.toLowerCase().includes(query) ||
          r.solicitante.nome.toLowerCase().includes(query)
      );
    }

    // Filtro por Categoria
    if (cat !== 'TODAS') {
      list = list.filter((r) => r.categoria === cat);
    }

    // Filtro por Centro de Custo
    if (cc !== 'TODOS') {
      list = list.filter((r) => r.centroCustoId === cc);
    }

    // Ordenação
    if (sort === 'maior_valor') {
      list.sort((a, b) => b.valor - a.valor);
    } else if (sort === 'menor_valor') {
      list.sort((a, b) => a.valor - b.valor);
    } else if (sort === 'prioridade') {
      const pWeights: Record<RequestPriority, number> = { CRITICA: 4, ALTA: 3, MEDIA: 2, BAIXA: 1 };
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

  readonly isAllSelected = computed<boolean>(() => {
    const pageItems = this.paginatedRequests();
    if (pageItems.length === 0) return false;
    const current = this.selectedIds();
    return pageItems.every((item) => current.has(item.id));
  });

  // Ações de Tabs e Filtros
  setTab(tab: RequestTab): void {
    this.currentTab.set(tab);
    this.currentPage.set(1);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
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

  setSortBy(sort: 'recentes' | 'maior_valor' | 'menor_valor' | 'prioridade'): void {
    this.sortBy.set(sort);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  // Ações de Seleção de Checkbox
  toggleSelectAll(): void {
    const current = new Set(this.selectedIds());
    const pageItems = this.paginatedRequests();

    if (this.isAllSelected()) {
      pageItems.forEach((item) => current.delete(item.id));
    } else {
      pageItems.forEach((item) => current.add(item.id));
    }
    this.selectedIds.set(current);
  }

  toggleSelect(id: string): void {
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }

  // Controle do Drawer de Criação
  openCreateDrawer(): void {
    this.resetCreateForm();
    this.isCreateDrawerOpen.set(true);
  }

  closeCreateDrawer(): void {
    this.isCreateDrawerOpen.set(false);
  }

  private resetCreateForm(): void {
    this.formTitulo.set('');
    this.formCategoria.set('EQUIPAMENTOS_TI');
    this.formCentroCustoId.set('cc-ti');
    this.formValor.set(null);
    this.formPrioridade.set('MEDIA');
    this.formJustificativa.set('');
    this.formAnexos.set([
      { nome: 'Cotacao_Oficial_Fornecedor.pdf', tamanho: '1.1 MB', tipo: 'application/pdf' },
    ]);
    this.formErrors.set({});
  }

  // Upload simulado de anexos
  triggerFileInput(): void {
    // Simula adição de arquivo com feedback rápido
    const mockFiles = [
      { nome: 'Proposta_Comercial_Revisada.pdf', tamanho: '2.4 MB', tipo: 'application/pdf' },
      { nome: 'Planilha_Custos_Estimados.xlsx', tamanho: '850 KB', tipo: 'application/vnd.ms-excel' },
      { nome: 'Especificacao_Tecnica.docx', tamanho: '620 KB', tipo: 'application/docx' },
    ];
    const randomFile = mockFiles[Math.floor(Math.random() * mockFiles.length)];
    this.formAnexos.update((list) => [...list, randomFile]);
    this.showToast(`Arquivo "${randomFile.nome}" anexado com sucesso.`, 'info');
  }

  removeAttachment(index: number): void {
    this.formAnexos.update((list) => list.filter((_, i) => i !== index));
  }

  // Submissão da Nova Solicitação
  submitNewRequest(): void {
    const errors: Record<string, string> = {};

    const titulo = this.formTitulo().trim();
    if (!titulo) {
      errors['titulo'] = 'Informe o título ou finalidade da solicitação.';
    } else if (titulo.length < 5) {
      errors['titulo'] = 'O título deve possuir pelo menos 5 caracteres.';
    }

    const valor = this.formValor();
    if (valor === null || valor <= 0) {
      errors['valor'] = 'O valor da solicitação deve ser maior que R$ 0,00.';
    }

    const justificativa = this.formJustificativa().trim();
    if (!justificativa) {
      errors['justificativa'] = 'Informe uma justificativa de negócio para o pedido.';
    } else if (justificativa.length < 30) {
      errors['justificativa'] = `A justificativa exige ao menos 30 caracteres conforme governança (atual: ${justificativa.length}).`;
    }

    if (Object.keys(errors).length > 0) {
      this.formErrors.set(errors);
      return;
    }

    this.formErrors.set({});
    this.isSubmitting.set(true);

    // Simulação assíncrona de submissão
    setTimeout(() => {
      const created = this.requestsService.createRequest({
        titulo,
        categoria: this.formCategoria(),
        centroCustoId: this.formCentroCustoId(),
        valor: valor as number,
        prioridade: this.formPrioridade(),
        justificativa,
        anexos: this.formAnexos(),
      });

      this.isSubmitting.set(false);
      this.closeCreateDrawer();
      this.showToast(`Solicitação ${created.codigo} criada e encaminhada ao fluxo com sucesso!`, 'success');

      // Seleciona a solicitação recém criada para visualização opcional
      this.openDetailDrawer(created);
    }, 600);
  }

  // Controle do Drawer de Detalhes
  openDetailDrawer(request: RequestItem): void {
    this.selectedRequest.set(request);
    this.isDetailDrawerOpen.set(true);
  }

  closeDetailDrawer(): void {
    this.isDetailDrawerOpen.set(false);
    this.selectedRequest.set(null);
  }

  // Cancelar solicitação atual
  cancelCurrentRequest(): void {
    const req = this.selectedRequest();
    if (!req) return;

    if (confirm(`Deseja realmente cancelar a solicitação ${req.codigo}?`)) {
      const success = this.requestsService.cancelRequest(req.id);
      if (success) {
        // Atualiza o item aberto
        const updated = this.requestsService.requests().find((r) => r.id === req.id) || null;
        this.selectedRequest.set(updated);
        this.showToast(`Solicitação ${req.codigo} foi cancelada.`, 'warning');
      }
    }
  }

  // Helper de badges e status
  getStatusBadgeClass(status: RequestStatus): string {
    switch (status) {
      case 'APROVADA':
        return 'badge-success';
      case 'PENDENTE':
        return 'badge-warning';
      case 'AJUSTE_SOLICITADO':
        return 'badge-adjust';
      case 'REJEITADA':
      case 'CANCELADA':
        return 'badge-danger';
      default:
        return 'badge-neutral';
    }
  }

  getStepStatusIcon(step: ApprovalStep): string {
    switch (step.status) {
      case 'CONCLUIDA':
        return 'check_circle';
      case 'EM_ANALISE':
        return 'hourglass_top';
      case 'AJUSTE':
        return 'edit_note';
      case 'REJEITADA':
        return 'cancel';
      default:
        return 'radio_button_unchecked';
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

  toggleViewMode(mode: 'cards' | 'table'): void {
    this.viewMode.set(mode);
  }

  toggleKpis(): void {
    this.showKpis.update((v) => !v);
  }

  getStatusBorderColor(status: RequestStatus): string {
    switch (status) {
      case 'APROVADA':
        return '#10b981';
      case 'PENDENTE':
        return '#644ef3';
      case 'AJUSTE_SOLICITADO':
        return '#f59e0b';
      case 'REJEITADA':
      case 'CANCELADA':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  }

  // Notificação Toast
  showToast(message: string, type: 'success' | 'warning' | 'info' = 'success'): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set(null);
    }, 4000);
  }

  closeToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastMessage.set(null);
  }
}
