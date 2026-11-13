import { TestBed } from '@angular/core/testing';
import { NotificacaoService } from '../../../shared/components/notificacao/notificacao.service';
import { SettingsService } from '../../settings/services/settings.service';
import {
  MAX_TENTATIVAS,
  RecuperacaoSenhaService,
  VALIDADE_DO_CODIGO_MS,
} from './recuperacao-senha.service';

describe('RecuperacaoSenhaService', () => {
  let service: RecuperacaoSenhaService;
  let settings: { findAccountByEmail: jest.Mock; redefinirSenhaPorEmail: jest.Mock };
  let notificacoes: { mostrar: jest.Mock };

  /** Código que apareceu na última notificação (o "e-mail" fictício). */
  function ultimoCodigo(): string {
    const chamadas = notificacoes.mostrar.mock.calls;
    return chamadas[chamadas.length - 1][0].destaque;
  }

  function codigoErrado(): string {
    return ultimoCodigo() === '000000' ? '111111' : '000000';
  }

  beforeEach(() => {
    sessionStorage.clear();
    settings = {
      findAccountByEmail: jest.fn((email: string) => (email === 'ana@startop.test' ? {} : null)),
      redefinirSenhaPorEmail: jest.fn().mockReturnValue(true),
    };
    notificacoes = { mostrar: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useValue: settings },
        { provide: NotificacaoService, useValue: notificacoes },
      ],
    });
    service = TestBed.inject(RecuperacaoSenhaService);
  });

  afterEach(() => jest.useRealTimers());

  it('rejeita e-mail que não existe e não notifica', () => {
    expect(() => service.solicitarCodigo('ninguem@startop.test')).toThrow(
      'Não encontramos uma conta com este e-mail.',
    );
    expect(notificacoes.mostrar).not.toHaveBeenCalled();
    expect(service.emailPendente()).toBe('');
  });

  it('gera um código de 6 dígitos e mostra na notificação', () => {
    service.solicitarCodigo(' Ana@Startop.test ');

    expect(ultimoCodigo()).toMatch(/^\d{6}$/);
    expect(service.emailPendente()).toBe('ana@startop.test');
  });

  it('confirma o código certo e libera a redefinição', () => {
    service.solicitarCodigo('ana@startop.test');

    expect(service.podeRedefinir()).toBe(false);
    expect(service.verificarCodigo(ultimoCodigo())).toEqual({ ok: true });
    expect(service.podeRedefinir()).toBe(true);
  });

  it('recusa código errado e bloqueia depois do limite de tentativas', () => {
    service.solicitarCodigo('ana@startop.test');
    const certo = ultimoCodigo();

    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      expect(service.verificarCodigo(codigoErrado())).toEqual({
        ok: false,
        erro: 'Código inválido. Confira e tente de novo.',
      });
    }
    expect(service.verificarCodigo(certo)).toEqual({
      ok: false,
      erro: 'Muitas tentativas. Peça um novo código.',
    });
  });

  it('recusa código expirado', () => {
    jest.useFakeTimers();
    service.solicitarCodigo('ana@startop.test');
    jest.advanceTimersByTime(VALIDADE_DO_CODIGO_MS + 1);

    expect(service.verificarCodigo(ultimoCodigo())).toEqual({
      ok: false,
      erro: 'Código expirado. Peça um novo código.',
    });
  });

  it('reenviar invalida o código anterior', () => {
    service.solicitarCodigo('ana@startop.test');
    const antigo = ultimoCodigo();
    service.reenviarCodigo();
    const novo = ultimoCodigo();

    expect(notificacoes.mostrar).toHaveBeenCalledTimes(2);
    if (antigo !== novo) {
      expect(service.verificarCodigo(antigo).ok).toBe(false);
    }
    expect(service.verificarCodigo(novo)).toEqual({ ok: true });
  });

  it('só troca a senha depois de confirmar o código e limpa o fluxo', () => {
    service.solicitarCodigo('ana@startop.test');
    expect(() => service.redefinirSenha('nova123')).toThrow('Sessão de recuperação expirada');

    service.verificarCodigo(ultimoCodigo());
    service.redefinirSenha('nova123');

    expect(settings.redefinirSenhaPorEmail).toHaveBeenCalledWith('ana@startop.test', 'nova123');
    expect(service.emailPendente()).toBe('');
    expect(service.podeRedefinir()).toBe(false);
  });
});
