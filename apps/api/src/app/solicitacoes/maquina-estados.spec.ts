import { ConflictException } from '@nestjs/common';
import {
  ERRO_CONFLITO_VERSAO,
  ERRO_TRANSICAO_INVALIDA,
  TRANSICOES,
  assertVersao,
  resolverTransicao,
} from './maquina-estados';

function erroDe(fn: () => unknown): ConflictException {
  try {
    fn();
  } catch (e) {
    return e as ConflictException;
  }
  throw new Error('era esperada uma exceção');
}

describe('Máquina de estados (ADR-005 / tabela de transições)', () => {
  it('contém exatamente as transições T01 a T06', () => {
    expect(TRANSICOES.map((t) => t.codigo)).toEqual(['T01', 'T02', 'T03', 'T04', 'T05', 'T06']);
  });

  it.each([
    [null, 'SUBMETER', 'PENDENTE', 'CRIACAO_SOLICITACAO'],
    ['PENDENTE', 'APROVAR', 'APROVADA', 'APROVACAO'],
    ['PENDENTE', 'REJEITAR', 'REJEITADA', 'REJEICAO'],
    ['PENDENTE', 'SOLICITAR_AJUSTE', 'EM_AJUSTE', 'PEDIDO_AJUSTE'],
    ['EM_AJUSTE', 'REENVIAR', 'PENDENTE', 'REENVIO_SOLICITACAO'],
    ['EM_AJUSTE', 'CANCELAR', 'REJEITADA', 'REJEICAO'],
  ] as const)('%s + %s → %s (evento %s)', (origem, acao, destino, evento) => {
    const t = resolverTransicao(origem, acao);
    expect(t.destino).toBe(destino);
    expect(t.evento).toBe(evento);
  });

  it.each([
    ['APROVADA', 'APROVAR'],
    ['APROVADA', 'REJEITAR'],
    ['REJEITADA', 'APROVAR'],
    ['REJEITADA', 'SOLICITAR_AJUSTE'],
  ] as const)('N05/N06: estado terminal %s recusa %s com 409 padronizado', (origem, acao) => {
    const erro = erroDe(() => resolverTransicao(origem, acao));
    expect(erro).toBeInstanceOf(ConflictException);
    expect(erro.getResponse()).toMatchObject({ error: ERRO_TRANSICAO_INVALIDA });
  });

  it.each([
    ['EM_AJUSTE', 'APROVAR'],
    ['PENDENTE', 'REENVIAR'],
    ['PENDENTE', 'SUBMETER'],
  ] as const)('recusa transição fora da tabela: %s + %s', (origem, acao) => {
    expect(() => resolverTransicao(origem, acao)).toThrow(ConflictException);
  });

  describe('assertVersao (N04 / CA-05.1)', () => {
    it('aceita a versão atual', () => {
      expect(() => assertVersao(3, 3)).not.toThrow();
    });

    it.each([[2], [4]])('recusa versão desatualizada (%s ≠ 3)', (informada) => {
      const erro = erroDe(() => assertVersao(3, informada));
      expect(erro.getResponse()).toMatchObject({ error: ERRO_CONFLITO_VERSAO });
    });

    it.each([[undefined], ['3'], [3.5], [null]])('recusa versão ausente ou inválida (%p)', (informada) => {
      expect(() => assertVersao(3, informada)).toThrow(ConflictException);
    });
  });
});
