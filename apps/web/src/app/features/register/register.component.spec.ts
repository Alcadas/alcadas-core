import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }, 15000);

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deve rejeitar senha com menos de 8 caracteres', () => {
    component.form.controls.senha.setValue('1234567');
    expect(component.form.controls.senha.invalid).toBe(true);

    component.form.controls.senha.setValue('12345678');
    expect(component.form.controls.senha.valid).toBe(true);
  });

  it('não deve imprimir dados sensíveis no console ao enviar o formulário (RNF09 / #38)', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.form.setValue({
      nome: 'Usuário Teste',
      email: 'teste@startop.com.br',
      senha: 'SenhaSegura123',
    });

    await component.enviar();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});