import { ConflictException } from '@nestjs/common';
import { StatusSolicitacao, TipoEventoTrilha } from '@alcadas-core/models';

/**
 * Ações que disparam transições no ciclo de vida da solicitação (ADR-005).
 */
export type AcaoSolicitacao =
  | 'SUBMETER'
  | 'APROVAR'
  | 'REJEITAR'
  | 'SOLICITAR_AJUSTE'
  | 'REENVIAR'
  | 'CANCELAR';

export type CodigoTransicao = 'T01' | 'T02' | 'T03' | 'T04' | 'T05' | 'T06';

export interface Transicao {
  codigo: CodigoTransicao;
  /** `null` representa o estado inexistente `[*]` (antes da criação). */
  origem: StatusSolicitacao | null;
  acao: AcaoSolicitacao;
  destino: StatusSolicitacao;
  /** Evento gravado na trilha SHA-256 quando a transição é efetivada (ADR-006). */
  evento: TipoEventoTrilha;
}

/**
 * Tabela única de transições permitidas — espelho fiel de
 * `alcadas-docs/docs/arquitetura/tabela-transicoes.md` (T01 a T06).
 * Qualquer par (origem, ação) fora desta tabela é recusado com 409 (N05/N06).
 */
export const TRANSICOES: readonly Transicao[] = Object.freeze([
  { codigo: 'T01', origem: null, acao: 'SUBMETER', destino: 'PENDENTE', evento: 'CRIACAO_SOLICITACAO' },
  { codigo: 'T02', origem: 'PENDENTE', acao: 'APROVAR', destino: 'APROVADA', evento: 'APROVACAO' },
  { codigo: 'T03', origem: 'PENDENTE', acao: 'REJEITAR', destino: 'REJEITADA', evento: 'REJEICAO' },
  { codigo: 'T04', origem: 'PENDENTE', acao: 'SOLICITAR_AJUSTE', destino: 'EM_AJUSTE', evento: 'PEDIDO_AJUSTE' },
  { codigo: 'T05', origem: 'EM_AJUSTE', acao: 'REENVIAR', destino: 'PENDENTE', evento: 'REENVIO_SOLICITACAO' },
  { codigo: 'T06', origem: 'EM_AJUSTE', acao: 'CANCELAR', destino: 'REJEITADA', evento: 'REJEICAO' },
] as Transicao[]);

export const ESTADOS_TERMINAIS: ReadonlySet<StatusSolicitacao> = new Set<StatusSolicitacao>([
  'APROVADA',
  'REJEITADA',
]);

/**
 * Códigos de erro padronizados da máquina de estados (corpo `error` da resposta 409).
 */
export const ERRO_TRANSICAO_INVALIDA = 'TRANSICAO_INVALIDA';
export const ERRO_CONFLITO_VERSAO = 'CONFLITO_VERSAO';

/**
 * Resolve a transição para o par (estado atual, ação). Lança `409 Conflict` com erro
 * padronizado quando a transição não existe na tabela (N05 / N06 / CA-03.4).
 */
export function resolverTransicao(
  origem: StatusSolicitacao | null,
  acao: AcaoSolicitacao,
): Transicao {
  const transicao = TRANSICOES.find((t) => t.origem === origem && t.acao === acao);
  if (!transicao) {
    const estado = origem ?? '[*]';
    const motivo = origem && ESTADOS_TERMINAIS.has(origem)
      ? `a solicitação está no estado terminal ${estado}`
      : `a ação ${acao} não é permitida a partir do estado ${estado}`;
    throw new ConflictException({
      error: ERRO_TRANSICAO_INVALIDA,
      message: `Transição inválida: ${motivo} (CA-03.4).`,
    });
  }
  return transicao;
}

/**
 * Confere a versão de concorrência otimista (N04 / CA-05.1).
 * A versão é obrigatória nas decisões: sem ela não há como garantir decisão única.
 */
export function assertVersao(versaoAtual: number, versaoInformada: unknown): void {
  if (typeof versaoInformada !== 'number' || !Number.isInteger(versaoInformada)) {
    throw new ConflictException({
      error: ERRO_CONFLITO_VERSAO,
      message: 'O campo "versao" é obrigatório e deve ser um inteiro (CA-05.1).',
    });
  }
  if (versaoInformada !== versaoAtual) {
    throw new ConflictException({
      error: ERRO_CONFLITO_VERSAO,
      message: `Conflito de concorrência: versão informada (${versaoInformada}) difere da atual (${versaoAtual}). Recarregue a solicitação (CA-05.1).`,
    });
  }
}
