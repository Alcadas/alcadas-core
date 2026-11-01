import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApprovalsComponent } from './approvals.component';
import { RequestsService } from '../requests/services/requests.service';

describe('ApprovalsComponent', () => {
  let component: ApprovalsComponent;
  let fixture: ComponentFixture<ApprovalsComponent>;
  let requestsService: RequestsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApprovalsComponent],
      providers: [RequestsService, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ApprovalsComponent);
    component = fixture.componentInstance;
    requestsService = TestBed.inject(RequestsService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute initial counts and grouped lists', () => {
    expect(component.pendingCount()).toBeGreaterThan(0);
    expect(component.pendingTotalValue()).toBeGreaterThan(0);
    expect(component.departments().length).toBeGreaterThan(0);
    expect(component.filteredRequests().length).toBeGreaterThan(0);
    expect(component.headerTabs().length).toBe(4);
  });

  it('should filter by tab', () => {
    component.setTab('ajustes');
    expect(component.activeTab()).toBe('ajustes');
    component.filteredRequests().forEach((req) => {
      expect(req.status).toBe('AJUSTE_SOLICITADO');
    });

    component.setTab('aprovadas');
    expect(component.activeTab()).toBe('aprovadas');
    component.filteredRequests().forEach((req) => {
      expect(req.status).toBe('APROVADA');
    });

    component.setTab('pendentes');
    expect(component.activeTab()).toBe('pendentes');
  });

  it('should filter by search query', () => {
    component.setSearchQuery('Figma');
    expect(component.filteredRequests().length).toBeGreaterThanOrEqual(1);
    expect(component.filteredRequests()[0].titulo).toContain('Figma');
  });

  it('should filter by department, category, cost center, and priority', () => {
    component.setDepartmentFilter('TI & Engenharia');
    expect(component.selectedDepartment()).toBe('TI & Engenharia');
    component.filteredRequests().forEach((r) => {
      expect(r.departamento).toBe('TI & Engenharia');
    });

    component.setCategoryFilter('EQUIPAMENTOS_TI');
    expect(component.selectedCategory()).toBe('EQUIPAMENTOS_TI');
    component.filteredRequests().forEach((r) => {
      expect(r.categoria).toBe('EQUIPAMENTOS_TI');
    });

    component.setCostCenterFilter('cc-ti');
    expect(component.selectedCostCenter()).toBe('cc-ti');

    component.setPriorityFilter('ALTA');
    expect(component.selectedPriority()).toBe('ALTA');
    component.filteredRequests().forEach((r) => {
      expect(r.prioridade).toBe('ALTA');
    });
  });

  it('should sort requests by value and priority', () => {
    component.setSortBy('maior_valor');
    const sortedDesc = component.filteredRequests();
    for (let i = 0; i < sortedDesc.length - 1; i++) {
      expect(sortedDesc[i].valor).toBeGreaterThanOrEqual(sortedDesc[i + 1].valor);
    }

    component.setSortBy('menor_valor');
    const sortedAsc = component.filteredRequests();
    for (let i = 0; i < sortedAsc.length - 1; i++) {
      expect(sortedAsc[i].valor).toBeLessThanOrEqual(sortedAsc[i + 1].valor);
    }

    component.setSortBy('prioridade');
    expect(component.filteredRequests().length).toBeGreaterThan(0);
  });

  it('should handle pagination', () => {
    component.setTab('todas');
    component.setPageSize(2);
    expect(component.pageSize()).toBe(2);
    expect(component.totalPages()).toBeGreaterThanOrEqual(2);

    component.setPage(2);
    expect(component.currentPage()).toBe(2);

    // Ignora páginas inválidas
    component.setPage(-1);
    expect(component.currentPage()).toBe(2);
  });

  it('should toggle KPI display', () => {
    expect(component.showKpis()).toBe(true);
    component.toggleKpis();
    expect(component.showKpis()).toBe(false);
    component.toggleKpis();
    expect(component.showKpis()).toBe(true);
  });

  it('should handle item selection and batch selection', () => {
    const list = component.paginatedRequests();
    if (list.length > 0) {
      component.toggleSelect(list[0].id);
      expect(component.selectedIds().has(list[0].id)).toBe(true);

      component.toggleSelectAll();
      expect(component.selectedIds().size).toBe(list.length);

      component.clearSelection();
      expect(component.selectedIds().size).toBe(0);
    }
  });

  it('should open and confirm digital signature modal', () => {
    const pendingReq = requestsService.requests().find((r) => r.status === 'PENDENTE');
    expect(pendingReq).toBeDefined();
    if (pendingReq) {
      component.openSignModal(pendingReq);
      expect(component.isSignModalOpen()).toBe(true);
      expect(component.signingRequest()?.id).toBe(pendingReq.id);

      component.onSignatureConfirmed({
        signatureDataUrl: 'data:image/png;base64,mock',
        comentario: 'Aprovado em teste',
      });

      expect(component.isSignModalOpen()).toBe(false);
      const updatedReq = requestsService.getRequestById(pendingReq.id);
      expect(updatedReq).toBeDefined();
    }
  });

  it('should handle batch approval via digital signature', () => {
    const pendingReqs = requestsService.requests().filter((r) => r.status === 'PENDENTE');
    if (pendingReqs.length >= 2) {
      component.toggleSelect(pendingReqs[0].id);
      component.toggleSelect(pendingReqs[1].id);

      component.openBatchSignModal();
      expect(component.isSignModalOpen()).toBe(true);
      expect(component.isBatchSignMode()).toBe(true);

      component.onSignatureConfirmed({
        signatureDataUrl: 'data:image/png;base64,mock',
        comentario: 'Aprovação em lote test',
      });

      expect(component.isSignModalOpen()).toBe(false);
      expect(component.selectedIds().size).toBe(0);
    }
  });

  it('should open and confirm technical validation modal', () => {
    const pendingReq = requestsService.requests().find((r) => r.status === 'PENDENTE');
    if (pendingReq) {
      component.openValidateModal(pendingReq);
      expect(component.validatingRequest()?.id).toBe(pendingReq.id);

      component.validationNote.set('Validação técnica completa');
      component.confirmValidation();

      expect(component.validatingRequest()).toBeNull();
    }
  });

  it('should open and confirm adjustment request modal', () => {
    const pendingReq = requestsService.requests().find((r) => r.status === 'PENDENTE');
    if (pendingReq) {
      component.openAdjustmentModal(pendingReq);
      expect(component.adjustingRequest()?.id).toBe(pendingReq.id);

      component.adjustmentReason.set('Favor enviar 3 orçamentos');
      component.confirmAdjustment();

      expect(component.adjustingRequest()).toBeNull();
      const updated = requestsService.getRequestById(pendingReq.id);
      expect(updated?.status).toBe('AJUSTE_SOLICITADO');
    }
  });

  it('should open and confirm rejection modal', () => {
    const pendingReq = requestsService.requests().find((r) => r.status === 'PENDENTE');
    if (pendingReq) {
      component.openRejectModal(pendingReq);
      expect(component.rejectingRequest()?.id).toBe(pendingReq.id);

      component.rejectionReason.set('Orçamento estourado');
      component.confirmRejection();

      expect(component.rejectingRequest()).toBeNull();
      const updated = requestsService.getRequestById(pendingReq.id);
      expect(updated?.status).toBe('REJEITADA');
    }
  });

  it('should open and close detail drawer', () => {
    const req = requestsService.requests()[0];
    component.openDetailDrawer(req);
    expect(component.isDetailDrawerOpen()).toBe(true);
    expect(component.selectedRequest()?.id).toBe(req.id);

    component.closeDetailDrawer();
    expect(component.isDetailDrawerOpen()).toBe(false);
  });
});
