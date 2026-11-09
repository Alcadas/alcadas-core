import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CreateRequestComponent } from './create-request.component';
import { RequestsService } from '../../services/requests.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { signal } from '@angular/core';

describe('CreateRequestComponent', () => {
  let component: CreateRequestComponent;
  let fixture: ComponentFixture<CreateRequestComponent>;
  let router: Router;
  let service: RequestsService;
  const mockUserSignal = signal<any>(null);

  beforeEach(async () => {
    jest.useFakeTimers();
    mockUserSignal.set(null);

    await TestBed.configureTestingModule({
      imports: [CreateRequestComponent],
      providers: [
        RequestsService,
        {
          provide: Router,
          useValue: {
            navigate: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => mockUserSignal(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateRequestComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    service = TestBed.inject(RequestsService);
    service.seedForTesting();
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate dynamic workflow based on amount', () => {
    component.formValor.set(10000);
    fixture.detectChanges();
    expect(component.suggestedWorkflow().totalEtapas).toBeGreaterThanOrEqual(1);

    component.formValor.set(85000);
    fixture.detectChanges();
    expect(component.suggestedWorkflow().totalEtapas).toBeGreaterThanOrEqual(2);
  });

  it('should validate invalid submissions', () => {
    component.formTitulo.set('');
    component.formValor.set(0);
    component.formJustificativa.set('Curta');

    component.submitNewRequest();
    expect(Object.keys(component.formErrors()).length).toBeGreaterThan(0);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should submit valid request and navigate back', () => {
    const initialTotal = service.requests().length;

    component.formTitulo.set('Aquisição de Servidores de Alta Disponibilidade');
    component.formValor.set(45000);
    component.formJustificativa.set(
      'Justificativa completa com mais de trinta caracteres para aprovação pelo comitê.'
    );

    component.submitNewRequest();
    jest.advanceTimersByTime(700);

    expect(service.requests().length).toBe(initialTotal + 1);
    expect(router.navigate).toHaveBeenCalledWith(['/solicitacoes'], {
      queryParams: { criada: 'true' },
    });
  });

  it('should save draft and navigate back', () => {
    component.formTitulo.set('Rascunho de Teste');
    component.saveDraft();
    expect(router.navigate).toHaveBeenCalledWith(['/solicitacoes']);
  });

  it('should navigate back on goBack', () => {
    component.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/solicitacoes']);
  });

  describe('Restrição de Centro de Custo por Departamento', () => {
    it('deve isolar e travar o centro de custo para solicitante do RH', () => {
      // Configura usuário de RH no mock signal
      mockUserSignal.set({
        id: 'usr-colab-rh',
        email: 'ana.rh@startop.com.br',
        name: 'Ana Recursos Humanos',
        role: 'SOLICITANTE',
        departmentId: 'dep-rh',
        departmentName: 'Recursos Humanos',
        costCenterId: 'CC-RH-01',
      });

      // Adiciona o centro de custo de RH nos centros disponíveis do serviço
      const centros = [
        { id: 'cc-ti', code: 'CC-TI-01', nome: 'Tecnologia & Infraestrutura', departamento: 'TI & Engenharia' },
        { id: 'dep-rh', code: 'CC-RH-01', nome: 'Recursos Humanos', departamento: 'Recursos Humanos' },
        { id: 'cc-fin', code: 'CC-FIN-02', nome: 'Controladoria & Finanças', departamento: 'Financeiro' },
      ];
      (service as any)._costCenters.set(centros);
      fixture.detectChanges();

      expect(component.isGlobalRequester()).toBe(false);
      const disponiveis = component.availableCostCenters();
      expect(disponiveis.length).toBe(1);
      expect(disponiveis[0].code).toBe('CC-RH-01');
      expect(disponiveis[0].nome).toBe('Recursos Humanos');
      expect(component.isCostCenterLocked()).toBe(true);
    });

    it('deve disponibilizar todos os centros de custo e manter seleção aberta para ADMIN ou DIRETOR_CFO', () => {
      mockUserSignal.set({
        id: 'usr-admin',
        email: 'admin@startop.com.br',
        name: 'Administrador Geral',
        role: 'ADMIN',
      });

      const centros = [
        { id: 'cc-ti', code: 'CC-TI-01', nome: 'Tecnologia & Infraestrutura', departamento: 'TI & Engenharia' },
        { id: 'dep-rh', code: 'CC-RH-01', nome: 'Recursos Humanos', departamento: 'Recursos Humanos' },
        { id: 'cc-fin', code: 'CC-FIN-02', nome: 'Controladoria & Finanças', departamento: 'Financeiro' },
      ];
      (service as any)._costCenters.set(centros);
      fixture.detectChanges();

      expect(component.isGlobalRequester()).toBe(true);
      expect(component.availableCostCenters().length).toBe(3);
      expect(component.isCostCenterLocked()).toBe(false);
    });

    it('deve isolar e travar o centro de custo para solicitante Bola (Controladoria) com centros vindos da API', () => {
      mockUserSignal.set({
        id: 'usr-bola',
        email: 'bola@startop.com',
        name: 'Bola',
        role: 'SOLICITANTE',
        departmentId: 'dep-fin',
        departmentName: 'Controladoria & Finanças',
        costCenterId: 'CC-101',
      });

      // Centros vindos da API (onde cc.departamento é undefined)
      const centrosApi = [
        { id: 'cc-api-1', code: 'CC-101', nome: 'Controladoria & Finanças' },
        { id: 'cc-api-2', code: 'CC001', nome: 'Operações & Logística' },
        { id: 'cc-api-3', code: 'CC002', nome: 'Tecnologia & Inovação' },
        { id: 'cc-api-4', code: 'CC-856', nome: 'Tecnologia e informacao' },
      ];
      (service as any)._costCenters.set(centrosApi);
      fixture.detectChanges();

      expect(component.isGlobalRequester()).toBe(false);
      const disponiveis = component.availableCostCenters();
      expect(disponiveis.length).toBe(1);
      expect(disponiveis[0].code).toBe('CC-101');
      expect(disponiveis[0].nome).toBe('Controladoria & Finanças');
      expect(component.isCostCenterLocked()).toBe(true);
    });
  });
});
