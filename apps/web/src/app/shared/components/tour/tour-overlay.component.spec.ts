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
      providers: [provideRouter([])],
    }).compileComponents();

    tourService = TestBed.inject(TourService);
    fixture = TestBed.createComponent(TourOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente de overlay do tour', () => {
    expect(component).toBeTruthy();
  });

  it('deve avançar e retroceder passos no tour', () => {
    tourService.startTour('dashboard');
    expect(tourService.currentStepIndex()).toBe(0);

    component.proximo();
    expect(tourService.currentStepIndex()).toBe(1);

    component.anterior();
    expect(tourService.currentStepIndex()).toBe(0);
  });

  it('deve encerrar o tour ao chamar fecharTour', () => {
    tourService.startTour('dashboard');
    expect(tourService.isTourActive()).toBe(true);

    component.fecharTour();
    expect(tourService.isTourActive()).toBe(false);
  });
});
