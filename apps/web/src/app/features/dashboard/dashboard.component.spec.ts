import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/auth/auth.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    jest.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => ({ name: 'Admin Teste', role: 'ADMIN' }),
            isAuthenticated: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    jest.advanceTimersByTime(700);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial chart data and budget segments', () => {
    expect(component.chartRequests().length).toBeGreaterThan(0);
    expect(component.budgetSegments().length).toBeGreaterThan(0);
  });

  it('should toggle period filter', () => {
    component.setPeriod('dia');
    expect(component.selectedPeriod()).toBe('dia');

    component.setPeriod('semana');
    expect(component.selectedPeriod()).toBe('semana');
  });
});
