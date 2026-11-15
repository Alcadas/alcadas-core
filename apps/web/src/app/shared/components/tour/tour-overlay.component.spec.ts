import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TourOverlayComponent } from './tour-overlay.component';
import { TourService } from '../../../core/services/tour.service';

describe('TourOverlayComponent', () => {
  let component: TourOverlayComponent;
  let fixture: ComponentFixture<TourOverlayComponent>;
  let tourService: TourService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TourOverlayComponent],
      providers: [provideRouter([{ path: '**', component: TourOverlayComponent }])],
    }).compileComponents();

    tourService = TestBed.inject(TourService);
    fixture = TestBed.createComponent(TourOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente de overlay do tour', () => {
    expect(component).toBeTruthy();
  });

  it('deve avançar e retroceder passos no tour', async () => {
    await tourService.startTour('onboarding');
    expect(tourService.currentStepIndex()).toBe(0);

    component.proximo();
    expect(tourService.currentStepIndex()).toBe(1);

    component.anterior();
    expect(tourService.currentStepIndex()).toBe(0);
  });

  it('deve encerrar o tour ao chamar fecharTour', async () => {
    await tourService.startTour('onboarding');
    expect(tourService.isTourActive()).toBe(true);

    component.fecharTour();
    expect(tourService.isTourActive()).toBe(false);
  });

  it('deve calcular posição do card centralizado quando não houver targetBox', () => {
    component.calculateCardPosition(null);
    const style = component.cardStyle();
    expect(style['top']).toBe('50%');
    expect(style['left']).toBe('50%');
  });

  it('deve calcular posição do card ao lado de um elemento em foco', () => {
    component.calculateCardPosition({
      top: 100,
      left: 50,
      width: 200,
      height: 60,
    });
    const style = component.cardStyle();
    expect(style['position']).toBe('fixed');
    expect(style['left']).toBeDefined();
    expect(style['top']).toBeDefined();
  });

  it('deve responder a atalhos de teclado (Escape, ArrowRight, ArrowLeft)', async () => {
    await tourService.startTour('onboarding');
    expect(tourService.currentStepIndex()).toBe(0);

    component.onArrowRight();
    expect(tourService.currentStepIndex()).toBe(1);

    component.onArrowLeft();
    expect(tourService.currentStepIndex()).toBe(0);

    component.onEscape();
    expect(tourService.isTourActive()).toBe(false);
  });

  it('deve iniciar tours específicos para abas de solicitações, aprovações, fluxos e regras', () => {
    tourService.startTour('solicitacoes');
    expect(tourService.isTourActive()).toBe(true);
    expect(tourService.currentContext()).toBe('solicitacoes');

    tourService.startTour('aprovacoes');
    expect(tourService.currentContext()).toBe('aprovacoes');

    tourService.startTour('meus-fluxos');
    expect(tourService.currentContext()).toBe('meus-fluxos');

    tourService.startTour('minhas-regras');
    expect(tourService.currentContext()).toBe('minhas-regras');

    tourService.startTour('criar-solicitacao');
    expect(tourService.currentContext()).toBe('criar-solicitacao');
    expect(tourService.tourSteps().length).toBeGreaterThanOrEqual(5);
  });

  describe('Posicionamento inteligente dentro de modal', () => {
    let mockModal: HTMLElement;

    beforeEach(() => {
      mockModal = document.createElement('div');
      mockModal.className = 'modal-card-create';
      jest.spyOn(mockModal, 'getBoundingClientRect').mockReturnValue({
        top: 50,
        left: 200,
        right: 1060,
        bottom: 650,
        width: 860,
        height: 600,
        x: 200,
        y: 50,
        toJSON: () => ({}),
      });
      document.body.appendChild(mockModal);
    });

    afterEach(() => {
      mockModal.remove();
      jest.restoreAllMocks();
    });

    it('deve posicionar o card na coluna direita quando o alvo estiver na coluna esquerda do modal', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true });

      component.calculateCardPosition({
        top: 100,
        left: 240,
        width: 320,
        height: 50,
      });

      const style = component.cardStyle();
      expect(style['position']).toBe('fixed');
      const leftVal = parseInt(style['left'], 10);
      // Deve estar na metade direita do modal (centro do modal = 200 + 430 = 630)
      expect(leftVal).toBeGreaterThanOrEqual(600);
    });

    it('deve posicionar o card na coluna esquerda quando o alvo estiver na coluna direita do modal', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true });

      component.calculateCardPosition({
        top: 100,
        left: 700,
        width: 300,
        height: 80,
      });

      const style = component.cardStyle();
      expect(style['position']).toBe('fixed');
      const leftVal = parseInt(style['left'], 10);
      // Deve estar na metade esquerda do modal (esquerda = 200 + 24 = 224)
      expect(leftVal).toBeLessThan(600);
      expect(leftVal).toBe(224);
    });

    it('deve ancorar na base em telas estreitas para não sobrepor elementos', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });

      component.calculateCardPosition({
        top: 100,
        left: 240,
        width: 320,
        height: 50,
      });

      const style = component.cardStyle();
      expect(style['bottom']).toBe('16px');
      expect(style['left']).toBe('16px');
    });
  });
});
