import { AuditoriaService, GENESIS_HASH } from '../auditoria/auditoria.service';
import { FirestoreService } from '../database/firestore.service';
import { TrilhaAuditoria } from './trilha';

process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:9';

describe('TrilhaAuditoria — elo de criação (T01)', () => {
  const elo = TrilhaAuditoria.gerarEloGenese(
    { centroCustoId: 'CC-01', valor: 500, categoria: 'SERVICOS_TERCEIROS' },
    'ana',
    '2026-11-01T12:00:00.000Z',
  );

  it('US-07: é o elo 1, parte do hash gênese e registra CRIACAO_SOLICITACAO', () => {
    expect(elo).toMatchObject({ sequencia: 1, hashAnterior: GENESIS_HASH, tipoEvento: 'CRIACAO_SOLICITACAO' });
    expect(elo.payload).toMatchObject({ transicao: 'T01', para: 'PENDENTE', valor: 500 });
  });

  it('US-08: a verificação da cadeia aceita o elo de criação', () => {
    const auditoria = new AuditoriaService(new FirestoreService());
    expect(auditoria.verificarElos([elo])).toMatchObject({ status: 'INTEGRA', totalElos: 1 });
  });

  it('CA-08.2: valor alterado no elo de criação é apontado como adulterado', () => {
    const auditoria = new AuditoriaService(new FirestoreService());
    const adulterado = { ...elo, payload: { ...elo.payload, valor: 50 } };
    expect(auditoria.verificarElos([adulterado])).toMatchObject({ eloInconsistente: 1, motivo: 'HASH_DIVERGENTE' });
  });
});
