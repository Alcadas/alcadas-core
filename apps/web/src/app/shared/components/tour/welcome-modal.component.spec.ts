import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WelcomeModalComponent } from './welcome-modal.component';
import { TourService } from '../../../core/services/tour.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthUser } from '../../../core/auth/auth.models';

describe('WelcomeModalComponent', () => {
  let component: WelcomeModalComponent;
  let fixture: ComponentFixture<WelcomeModalComponent>;
  let tourService: TourService;
  let currentUser: ReturnType<typeof signal<AuthUser | null>>;
  let isDeveloper: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    localStorage.clear();
    currentUser = signal<AuthUser | null>(null);
    isDeveloper = signal(false);

    await TestBed.configureTestingModule({
      imports: [WelcomeModalComponent],
      providers: [
        provideRouter([{ path: '**', component: WelcomeModalComponent }]),
        { provide: AuthService, useValue: { currentUser, isDeveloper } },
      ],
    }).compileComponents();

    tourService = TestBed.inject(TourService);
    fixture = TestBed.createComponent(WelcomeModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('oferece o boas-vindas a quem loga pela primeira vez (#109)', () => {
    jest.useFakeTimers();
    currentUser.set({ id: 'emp-1', email: 'julia@startop.com.br', tenantId: 'startop' });
    fixture.detectChanges();

    jest.advanceTimersByTime(600);
    expect(tourService.showWelcomeModal()).toBe(true);
  });

  it('não oferece o boas-vindas ao acesso de desenvolvedor (#109)', () => {
    jest.useFakeTimers();
    currentUser.set({ id: 'dev-master', email: 'dev@alcadas.com', tenantId: 'startop' });
    isDeveloper.set(true);
    fixture.detectChanges();

    jest.advanceTimersByTime(1_000);
    expect(tourService.showWelcomeModal()).toBe(false);
  });
});
