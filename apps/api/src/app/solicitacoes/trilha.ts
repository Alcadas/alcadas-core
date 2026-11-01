import * as crypto from 'crypto';

export class TrilhaAuditoria {
  static gerarEloGenese(payload: Record<string, unknown>, authorId: string, timestampUtc: string) {
    const hashAnterior = '0000000000000000000000000000000000000000000000000000000000000000';
    const canonicalPayload = JSON.stringify(payload);
    
    const stringParaHash = `${hashAnterior}${timestampUtc}${authorId}${canonicalPayload}`;
    const hashAtual = crypto.createHash('sha256').update(stringParaHash).digest('hex');

    return {
      sequencia: 0,
      hashAnterior,
      hashAtual,
      action: 'CRIACAO_SOLICITACAO',
      authorId,
      timestampUtc,
      canonicalPayload: payload
    };
  }
}