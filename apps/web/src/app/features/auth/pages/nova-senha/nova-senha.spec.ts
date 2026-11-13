import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RecuperacaoSenhaService } from '../../services/recuperacao-senha.service';
import { NovaSenha } from './nova-senha';

describe('NovaSenha', () => {
  let recuperacao: { podeRedefinir: jest.Mock; redefinirSenha: jest.Mock };
  let navegar: jest.SpyInstance;

  function criar() {
    TestBed.configureTestingModule({
      imports: [NovaSenha],
      providers: [provideRouter([]), { provide: RecuperacaoSenhaService, useValue: recuperacao }],
    });
    navegar = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(NovaSenha);
    fixture.detectChanges();
    return fixture;
  }

  function preencher(fixture: ReturnType<typeof criar>, senha: string, confirmar = senha): void {
    fixture.componentInstance.form.setValue({ senha, confirmar });
  }

  beforeEach(() => {
    recuperacao = {
      podeRedefinir: jest.fn().mockReturnValue(true),
      redefinirSenha: jest.fn(),
    };
  });

  it('volta para recuperar senha sem o código confirmado', () => {
    recuperacao.podeRedefinir.mockReturnValue(false);
    criar();
    expect(navegar).toHaveBeenCalledWith(['/recuperar-senha']);
  });

  it.each([
    ['curta', 'ab1'],
    ['sem número', 'abcdefg'],
    ['sem letra', '1234567'],
  ])('não aceita senha %s', (_caso, senha) => {
    const fixture = criar();
    preencher(fixture, senha);
    fixture.componentInstance.enviar();
    expect(recuperacao.redefinirSenha).not.toHaveBeenCalled();
  });

  it('não aceita confirmação diferente', () => {
    const fixture = criar();
    preencher(fixture, 'senha123', 'senha124');
    fixture.componentInstance.enviar();
    expect(recuperacao.redefinirSenha).not.toHaveBeenCalled();
  });

  it('troca a senha e mostra a confirmação', () => {
    const fixture = criar();
    preencher(fixture, 'senha123');
    fixture.componentInstance.enviar();
    fixture.detectChanges();

    expect(recuperacao.redefinirSenha).toHaveBeenCalledWith('senha123');
    expect(fixture.nativeElement.textContent).toContain('Senha alterada!');
  });

  it('mostra o erro quando a sessão de recuperação expirou', () => {
    recuperacao.redefinirSenha.mockImplementation(() => {
      throw new Error('Sessão de recuperação expirada. Comece de novo.');
    });
    const fixture = criar();
    preencher(fixture, 'senha123');
    fixture.componentInstance.enviar();
    fixture.detectChanges();

    expect(fixture.componentInstance.concluido).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('expirada');
  });
});
