import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RecuperacaoSenhaService } from '../../services/recuperacao-senha.service';
import { RecuperarSenha } from './recuperar-senha';

describe('RecuperarSenha', () => {
  let recuperacao: { solicitarCodigo: jest.Mock };

  function criar() {
    TestBed.configureTestingModule({
      imports: [RecuperarSenha],
      providers: [provideRouter([]), { provide: RecuperacaoSenhaService, useValue: recuperacao }],
    });
    const fixture = TestBed.createComponent(RecuperarSenha);
    fixture.detectChanges();
    return fixture;
  }

  function digitarEmail(fixture: ReturnType<typeof criar>, email: string): void {
    const campo = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#email');
    if (!campo) throw new Error('campo de e-mail não encontrado');
    campo.value = email;
    campo.dispatchEvent(new Event('input'));
  }

  function texto(fixture: ReturnType<typeof criar>): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    recuperacao = { solicitarCodigo: jest.fn() };
  });

  it('não pede código com e-mail vazio ou inválido', () => {
    const fixture = criar();

    fixture.componentInstance.enviar();
    digitarEmail(fixture, 'nao-e-email');
    fixture.componentInstance.enviar();

    expect(recuperacao.solicitarCodigo).not.toHaveBeenCalled();
    expect(texto(fixture)).toContain('Informe um e-mail válido.');
  });

  it('pede o código e vai para a tela de verificação', () => {
    const fixture = criar();
    const navegar = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    digitarEmail(fixture, '  Ana@Startop.test ');
    fixture.componentInstance.enviar();

    expect(recuperacao.solicitarCodigo).toHaveBeenCalledWith('ana@startop.test');
    expect(navegar).toHaveBeenCalledWith(['/verificarCodigo']);
  });

  it('mostra a mensagem quando o e-mail não está cadastrado e continua na tela', () => {
    recuperacao.solicitarCodigo.mockImplementation(() => {
      throw new Error('Não encontramos uma conta com este e-mail.');
    });
    const fixture = criar();
    const navegar = jest.spyOn(TestBed.inject(Router), 'navigate');

    digitarEmail(fixture, 'ninguem@startop.test');
    fixture.componentInstance.enviar();

    expect(navegar).not.toHaveBeenCalled();
    expect(texto(fixture)).toContain('Não encontramos uma conta com este e-mail.');
  });
});
