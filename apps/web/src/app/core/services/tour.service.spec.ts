import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TourService } from './tour.service';

describe('TourService', () => {
  let service: TourService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TourService,
        {
          provide: Router,
          useValue: {
            url: '/solicitacoes',
            navigateByUrl: jest.fn().mockResolvedValue(true),
            navigate: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    });

    service = TestBed.inject(TourService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('deve inicializar com estado inativo', () => {
    expect(service.isTourActive()).toBe(false);
    expect(service.currentStepIndex()).toBe(0);
  });

  it('deve iniciar o tour de criação de solicitação e navegar pelos passos', () => {
    service.startTour('criar-solicitacao');
    expect(service.isTourActive()).toBe(true);
    expect(service.currentContext()).toBe('criar-solicitacao');
    expect(service.isFirstStep()).toBe(true);
    expect(service.isLastStep()).toBe(false);

    service.nextStep();
    expect(service.currentStepIndex()).toBe(1);
    expect(service.isFirstStep()).toBe(false);

    service.prevStep();
    expect(service.currentStepIndex()).toBe(0);
    expect(service.isFirstStep()).toBe(true);
  });

  it('deve abrir o modal quando o próximo passo for um elemento interno do modal', () => {
    const mockBtn = document.createElement('button');
    mockBtn.setAttribute('data-tour', 'btn-new-request');
    const clickSpy = jest.spyOn(mockBtn, 'click');
    document.body.appendChild(mockBtn);

    service.startTour('criar-solicitacao');

    // Avança até o passo que foca no modal (data-tour="solicitacao-titulo")
    const steps = service.tourSteps();
    const tituloIdx = steps.findIndex((s) => s.targetSelector === '[data-tour="solicitacao-titulo"]');
    expect(tituloIdx).toBeGreaterThan(0);

    service.currentStepIndex.set(tituloIdx - 1);
    service.nextStep();

    expect(clickSpy).toHaveBeenCalled();
  });

  it('deve fechar o modal ao retroceder para o botão de nova solicitação na página', () => {
    const mockModal = document.createElement('div');
    mockModal.setAttribute('data-tour', 'solicitacao-modal');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-close-sm';
    const closeSpy = jest.spyOn(closeBtn, 'click');
    mockModal.appendChild(closeBtn);
    document.body.appendChild(mockModal);

    service.startTour('criar-solicitacao');

    const steps = service.tourSteps();
    const tituloIdx = steps.findIndex((s) => s.targetSelector === '[data-tour="solicitacao-titulo"]');
    service.currentStepIndex.set(tituloIdx);

    service.prevStep(); // Retrocede para btn-new-request
    expect(closeSpy).toHaveBeenCalled();
  });

  it('deve identificar a rota atual e disparar o tour apropriado', () => {
    Object.defineProperty(router, 'url', { value: '/solicitacoes' });
    service.startTourForCurrentRoute();
    expect(service.currentContext()).toBe('solicitacoes');

    Object.defineProperty(router, 'url', { value: '/aprovacoes' });
    service.startTourForCurrentRoute();
    expect(service.currentContext()).toBe('aprovacoes');

    Object.defineProperty(router, 'url', { value: '/alcadas/regras' });
    service.startTourForCurrentRoute();
    expect(service.currentContext()).toBe('minhas-regras');

    Object.defineProperty(router, 'url', { value: '/alcadas' });
    service.startTourForCurrentRoute();
    expect(service.currentContext()).toBe('meus-fluxos');
  });

  it('deve concluir o tour no último passo', () => {
    service.startTour('criar-solicitacao');
    const total = service.tourSteps().length;
    service.currentStepIndex.set(total - 1);
    expect(service.isLastStep()).toBe(true);

    service.nextStep();
    expect(service.isTourActive()).toBe(false);
  });
});
