import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CreateRequestComponent } from './create-request.component';
import { RequestsService } from '../../services/requests.service';

describe('CreateRequestComponent', () => {
  let component: CreateRequestComponent;
  let fixture: ComponentFixture<CreateRequestComponent>;
  let router: Router;
  let service: RequestsService;

  beforeEach(async () => {
    jest.useFakeTimers();
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateRequestComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    service = TestBed.inject(RequestsService);
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
});
