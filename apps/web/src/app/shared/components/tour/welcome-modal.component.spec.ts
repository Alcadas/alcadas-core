import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WelcomeModalComponent } from './welcome-modal.component';
import { TourService } from '../../../core/services/tour.service';

describe('WelcomeModalComponent', () => {
  let component: WelcomeModalComponent;
  let fixture: ComponentFixture<WelcomeModalComponent>;
  let tourService: TourService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WelcomeModalComponent],
      providers: [provideRouter([{ path: '**', component: WelcomeModalComponent }])],
    }).compileComponents();

    tourService = TestBed.inject(TourService);
    fixture = TestBed.createComponent(WelcomeModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente do modal de boas-vindas', () => {
    expect(component).toBeTruthy();
  });

  it('deve fechar o modal ao chamar fecharModal', () => {
    tourService.openWelcomeModal();
    expect(tourService.showWelcomeModal()).toBe(true);

    component.fecharModal();
    expect(tourService.showWelcomeModal()).toBe(false);
  });

  it('deve iniciar tour a partir do modal', () => {
    tourService.openWelcomeModal();
    component.iniciarTour();
    expect(tourService.showWelcomeModal()).toBe(false);
    expect(tourService.isTourActive()).toBe(true);
  });
});
