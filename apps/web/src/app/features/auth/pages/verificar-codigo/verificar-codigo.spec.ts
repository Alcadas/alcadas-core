import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RecuperacaoSenhaService } from '../../services/recuperacao-senha.service';
import { SEGUNDOS_PARA_REENVIAR, VerificarCodigo } from './verificar-codigo';

describe('VerificarCodigo', () => {
  let recuperacao: {
    emailPendente: jest.Mock;
    verificarCodigo: jest.Mock;
    reenviarCodigo: jest.Mock;
  };
  let navegar: jest.SpyInstance;

  function criar() {
    TestBed.configureTestingModule({
      imports: [VerificarCodigo],
      providers: [provideRouter([]), { provide: RecuperacaoSenhaService, useValue: recuperacao }],
    });
    navegar = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(VerificarCodigo);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    recuperacao = {
      emailPendente: jest.fn().mockReturnValue('ana@startop.test'),
      verificarCodigo: jest.fn(),
      reenviarCodigo: jest.fn(),
    };
  });

  afterEach(() => jest.useRealTimers());

  it('volta para recuperar senha quando não há código pedido', () => {
    recuperacao.emailPendente.mockReturnValue('');
    criar();
    expect(navegar).toHaveBeenCalledWith(['/recuperar-senha']);
  });

  it('mostra o e-mail e vai para a nova senha com o código certo', () => {
    recuperacao.verificarCodigo.mockReturnValue({ ok: true });
    const fixture = criar();
    expect(fixture.nativeElement.textContent).toContain('ana@startop.test');

    fixture.componentInstance.digitos = '123456'.split('');
    fixture.componentInstance.verificar(new Event('submit'));

    expect(recuperacao.verificarCodigo).toHaveBeenCalledWith('123456');
    expect(navegar).toHaveBeenCalledWith(['/novaSenha']);
  });

  it('mostra o erro e limpa os dígitos com o código errado', () => {
    recuperacao.verificarCodigo.mockReturnValue({ ok: false, erro: 'Código inválido. Confira e tente de novo.' });
    const fixture = criar();

    fixture.componentInstance.digitos = '999999'.split('');
    fixture.componentInstance.verificar(new Event('submit'));
    fixture.detectChanges();

    expect(navegar).not.toHaveBeenCalledWith(['/novaSenha']);
    expect(fixture.componentInstance.digitos.join('')).toBe('');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Código inválido');
  });

  it('só reenvia o código depois da contagem regressiva', () => {
    const fixture = criar();

    fixture.componentInstance.reenviar();
    expect(recuperacao.reenviarCodigo).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000);
    expect(fixture.componentInstance.segundos()).toBe(SEGUNDOS_PARA_REENVIAR - 1);

    jest.advanceTimersByTime((SEGUNDOS_PARA_REENVIAR - 1) * 1_000);
    expect(fixture.componentInstance.segundos()).toBe(0);
    fixture.componentInstance.reenviar();
    expect(recuperacao.reenviarCodigo).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });
});
