import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApprovalsComponent } from './approvals.component';
import { RequestsService } from '../requests/services/requests.service';
import { AuthService } from '../../core/auth/auth.service';

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
    requestsService.seedForTesting();
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
      expect(req.status).toBe('EM_AJUSTE');
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

    component.setCategoryFilter('EQUIPAMENTOS');
    expect(component.selectedCategory()).toBe('EQUIPAMENTOS');
    component.filteredRequests().forEach((r) => {
      expect(r.categoria).toBe('EQUIPAMENTOS');
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
      expect(updated?.status).toBe('EM_AJUSTE');
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

  describe('Isolamento de Departamento (Cenário 2)', () => {
    it('deve filtrar e exibir apenas solicitações do próprio departamento para aprovador setorial', () => {
      const authService = TestBed.inject(AuthService);
      jest.spyOn(authService, 'currentUser').mockReturnValue({
        id: 'usr-gestor-rh',
        email: 'gestor.rh@startop.com.br',
        name: 'Gestor de RH',
        role: 'APROVADOR_N1',
        departmentId: 'dep-rh',
        departmentName: 'Recursos Humanos',
        costCenterId: 'CC-RH-01',
      });

      // Adiciona uma solicitação de outro colaborador do RH (para respeitar SoD)
      const novaReq = requestsService.createRequest({
        titulo: 'Treinamento de Liderança RH',
        categoria: 'SERVICOS_TERCEIROS',
        centroCustoId: 'CC-RH-01',
        valor: 800,
        justificativa: 'Treinamento obrigatório para novos líderes de setor.',
      });
      // Simula que a solicitação foi criada por outro colaborador da equipe
      (requestsService as unknown as { _requests: { update: (fn: (l: unknown[]) => unknown[]) => void } })[
        '_requests'
      ].update((lista) =>
        lista.map((item) =>
          (item as { id: string }).id === novaReq.id
            ? {
                ...(item as Record<string, unknown>),
                departamento: 'Recursos Humanos',
                solicitante: { id: 'usr-colaborador-rh', nome: 'Ana Paula (Analista RH)', cargo: 'Analista' },
              }
            : item,
        ),
      );

      const elegiveis = component.approvalEligibleRequests();
      // Solicitações de TI & Engenharia devem ter sido excluídas para o gestor de RH
      expect(elegiveis.some((r) => r.departamento === 'TI & Engenharia')).toBe(false);
      // Solicitação de RH deve estar presente
      expect(
        elegiveis.some((r) => r.centroCustoId === 'CC-RH-01' || r.departamento === 'Recursos Humanos'),
      ).toBe(true);
    });

    it('DIRETOR_CFO deve visualizar solicitações de todos os departamentos (escopo corporativo)', () => {
      const authService = TestBed.inject(AuthService);
      jest.spyOn(authService, 'currentUser').mockReturnValue({
        id: 'usr-cfo',
        email: 'cfo@startop.com.br',
        name: 'Diretor Financeiro',
        role: 'DIRETOR_CFO',
      });

      const elegiveis = component.approvalEligibleRequests();
      expect(elegiveis.length).toBeGreaterThan(0);
      expect(elegiveis.some((r) => r.departamento === 'TI & Engenharia')).toBe(true);
    });
  });

  describe('Polling Inteligente & Notificações na Esteira de Aprovação', () => {
    it('inicia o polling ao carregar a tela e encerra no ngOnDestroy', () => {
      const startSpy = jest.spyOn(requestsService, 'startPolling');
      const stopSpy = jest.spyOn(requestsService, 'stopPolling');

      component.ngOnInit();
      expect(startSpy).toHaveBeenCalledWith(8000);

      fixture.destroy();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('exibe notificação toast quando uma nova demanda pendente ingressa na esteira', () => {
      component.ngOnInit();

      // Emite evento simulando chegada de nova demanda via polling
      (requestsService as unknown as { _statusEvents: { next: (val: unknown) => void } })[
        '_statusEvents'
      ].next({
        type: 'NOVA',
        request: {
          id: 'sol-nova-099',
          codigo: '#SOL-099',
          status: 'PENDENTE',
          titulo: 'Servidor Dedicado',
        },
      });

      expect(component.toast()).toMatchObject({
        title: 'Nova Demanda',
        type: 'info',
      });
      expect(component.toast()?.message).toContain('#SOL-099');
    });
  });
});
