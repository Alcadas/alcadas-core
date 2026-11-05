import { GENESIS_HASH, calcularHashElo } from '../auditoria/auditoria.service';

export class TrilhaAuditoria {
  /**
   * Primeiro elo da trilha (T01 — CRIACAO_SOLICITACAO), no mesmo formato e com a mesma fórmula
   * dos elos das transições (ADR-006). Assim a verificação da cadeia (US-08) cobre também a criação.
   */
  static gerarEloGenese(
    payload: Record<string, unknown>,
    authorId: string,
    timestampUtc: string,
  ) {
    const tipoEvento = 'CRIACAO_SOLICITACAO' as const;
    const payloadElo = { transicao: 'T01', de: null, para: 'PENDENTE', versao: 1, ...payload };
    const hashAtual = calcularHashElo({
      hashAnterior: GENESIS_HASH,
      timestampUtc,
      authorId,
      tipoEvento,
      payload: payloadElo,
    });

    return {
      sequencia: 1,
      hashAnterior: GENESIS_HASH,
      hashAtual,
      tipoEvento,
      authorId,
      timestampUtc,
      payload: payloadElo,
    };
  }
}
