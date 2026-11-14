import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment as environmentProd } from '../../../../../environments/environment.prod';
import { AuthService } from '../../../../core/auth/auth.service';
import { APP_CONFIG, AppConfig } from '../../../../core/config/app-config';
import { CONFIG_DE_TESTE } from '../../../../core/testing/test-config';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let authService: { login: jest.Mock; loginAsDeveloper?: jest.Mock };

  function criar(config: AppConfig = CONFIG_DE_TESTE) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: APP_CONFIG, useValue: config },
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
    authService = { login: jest.fn(), loginAsDeveloper: jest.fn() };
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

  describe('Remoção de atalhos de desenvolvedor em produção (Issue #39)', () => {
    it('exibe o botão "Acesso de Desenvolvedor" quando production === false', () => {
      const fixture = criar({ ...CONFIG_DE_TESTE, production: false });
      const botaoDev = fixture.nativeElement.querySelector('.btn-dev-access');
      const divisorDev = fixture.nativeElement.querySelector('.dev-access-divider');

      expect(botaoDev).not.toBeNull();
      expect(divisorDev).not.toBeNull();
    });

    it('oculta o botão "Acesso de Desenvolvedor" e o divisor quando production === true', () => {
      const fixture = criar({ ...CONFIG_DE_TESTE, production: true });
      const botaoDev = fixture.nativeElement.querySelector('.btn-dev-access');
      const divisorDev = fixture.nativeElement.querySelector('.dev-access-divider');

      expect(botaoDev).toBeNull();
      expect(divisorDev).toBeNull();
    });

    it('bloqueia enterAsDeveloper() quando production === true', () => {
      const fixture = criar({ ...CONFIG_DE_TESTE, production: true });
      const navegar = jest.spyOn(TestBed.inject(Router), 'navigate');

      fixture.componentInstance.enterAsDeveloper();

      expect(authService.loginAsDeveloper).not.toHaveBeenCalled();
      expect(authService.login).not.toHaveBeenCalled();
      expect(navegar).not.toHaveBeenCalled();
    });

    it('environment.prod define production === true e não inclui credenciais de dev', () => {
      expect(environmentProd.production).toBe(true);
      expect(environmentProd.devAccess).toBeUndefined();
      expect(JSON.stringify(environmentProd)).not.toContain('dev@alcadas.com');
      expect(JSON.stringify(environmentProd)).not.toContain('dev123456');
    });
  });
});
