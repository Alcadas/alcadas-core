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
});
