import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { APP_CONFIG } from '../../../../core/config/app-config';
import { AppConfig } from '../../../../core/config/app-config.model';
import { CONFIG_DE_TESTE } from '../../../../core/testing/test-config';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let authService: { login: jest.Mock; loginAsDeveloper?: jest.Mock };

  function criar(configCustom?: Partial<AppConfig>) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        {
          provide: APP_CONFIG,
          useValue: { ...CONFIG_DE_TESTE, ...configCustom },
        },
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  function preencher(fixture: ReturnType<typeof criar>, email: string, senha: string): void {
    const elemento: HTMLElement = fixture.nativeElement;
    const campoEmail = elemento.querySelector<HTMLInputElement>('#email');
    const campoSenha = elemento.querySelector<HTMLInputElement>('#password');
    if (!campoEmail || !campoSenha) throw new Error('campos do login não encontrados');
    campoEmail.value = email;
    campoEmail.dispatchEvent(new Event('input'));
    campoSenha.value = senha;
    campoSenha.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    authService = { login: jest.fn() };
  });

  it('não chama o login com o formulário vazio', () => {
    const fixture = criar();
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(authService.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Informe e-mail e senha');
  });

  it('entra e vai para o dashboard', () => {
    authService.login.mockReturnValue(of({ id: 'ana', email: 'ana@startop.test' }));
    const fixture = criar();
    const navegar = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    preencher(fixture, 'ana@startop.test', 'senha123');
    fixture.componentInstance.onSubmit();

    expect(authService.login).toHaveBeenCalledWith({ email: 'ana@startop.test', password: 'senha123' });
    expect(navegar).toHaveBeenCalledWith(['/dashboard']);
  });

  it('mostra a mensagem do erro de login e continua na tela', () => {
    authService.login.mockReturnValue(throwError(() => new Error('E-mail ou senha incorretos.')));
    const fixture = criar();
    const navegar = jest.spyOn(TestBed.inject(Router), 'navigate');

    preencher(fixture, 'ana@startop.test', 'errada');
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(navegar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('E-mail ou senha incorretos.');
  });

  it('exibe o botão de desenvolvedor quando não está em produção', () => {
    const fixture = criar({ production: false });
    expect(fixture.nativeElement.querySelector('.btn-dev-access')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dev-access-divider')).toBeTruthy();
  });

  it('oculta o botão e divisor de desenvolvedor quando em produção (RNF08 / #38)', () => {
    const fixture = criar({ production: true });
    expect(fixture.nativeElement.querySelector('.btn-dev-access')).toBeNull();
    expect(fixture.nativeElement.querySelector('.dev-access-divider')).toBeNull();
  });

  it('enterAsDeveloper não executa autenticação quando em produção', () => {
    authService.loginAsDeveloper = jest.fn();
    const fixture = criar({ production: true });
    fixture.componentInstance.enterAsDeveloper();

    expect(authService.loginAsDeveloper).not.toHaveBeenCalled();
  });
});
