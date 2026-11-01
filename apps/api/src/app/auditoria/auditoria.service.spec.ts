import { EloAuditoriaDto } from '@alcadas-core/models';
import { FirestoreService } from '../database/firestore.service';
import { AuditoriaService, GENESIS_HASH } from './auditoria.service';

// Porta sem serviço: o FirestoreService cai no store em memória (sem depender do emulador).
process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:9';

const TENANT = 'startop';
const SOLICITACAO = 'sol-001';

async function cadeiaComTresElos(auditoria: AuditoriaService): Promise<EloAuditoriaDto[]> {
  await auditoria.recordEvent({
    tenantId: TENANT,
    requestId: SOLICITACAO,
    tipoEvento: 'CRIACAO_SOLICITACAO',
    authorId: 'ana',
    payload: { valor: 3200, categoria: 'SERVICOS_TERCEIROS' },
    timestampUtc: '2026-10-27T10:02:00.000Z',
  });
  await auditoria.recordEvent({
    tenantId: TENANT,
    requestId: SOLICITACAO,
    tipoEvento: 'PEDIDO_AJUSTE',
    authorId: 'carlos',
    payload: { motivo: 'Anexar os três orçamentos' },
    timestampUtc: '2026-10-27T11:00:00.000Z',
  });
  await auditoria.recordEvent({
    tenantId: TENANT,
    requestId: SOLICITACAO,
    tipoEvento: 'APROVACAO',
    authorId: 'carlos',
    payload: { valor: 3200 },
    timestampUtc: '2026-10-27T14:30:00.000Z',
  });
  return auditoria.getAuditTrail(TENANT, SOLICITACAO);
}

describe('AuditoriaService — cadeia SHA-256 (ADR-006)', () => {
  let auditoria: AuditoriaService;

  beforeEach(() => {
    auditoria = new AuditoriaService(new FirestoreService());
  });

  it('US-07: cada elo aponta para o hash do anterior, começando no gênese', async () => {
    const elos = await cadeiaComTresElos(auditoria);

    expect(elos.map((e) => e.sequencia)).toEqual([1, 2, 3]);
    expect(elos[0].hashAnterior).toBe(GENESIS_HASH);
    expect(elos[1].hashAnterior).toBe(elos[0].hashAtual);
    expect(elos[2].hashAnterior).toBe(elos[1].hashAtual);
    elos.forEach((e) => expect(e.hashAtual).toMatch(/^[0-9a-f]{64}$/));
  });

  it('o hash é determinístico e independe da ordem das chaves do payload', () => {
    const base = {
      hashAnterior: GENESIS_HASH,
      timestampUtc: '2026-10-27T10:02:00.000Z',
      authorId: 'ana',
      tipoEvento: 'CRIACAO_SOLICITACAO' as const,
    };
    const a = auditoria.computeSha256Hash({ ...base, payload: { valor: 10, categoria: 'X' } });
    const b = auditoria.computeSha256Hash({ ...base, payload: { categoria: 'X', valor: 10 } });
    expect(a).toBe(b);
  });

  it('cadeia íntegra → INTEGRA, sem elo inconsistente', async () => {
    await cadeiaComTresElos(auditoria);
    const resultado = await auditoria.verificarCadeia(TENANT, SOLICITACAO);

    expect(resultado).toMatchObject({ status: 'INTEGRA', totalElos: 3, eloInconsistente: null });
    expect(resultado.tempoProcessamentoMs).toBeLessThan(1000);
  });

  it('CA-08.2: valor alterado à mão no elo 1 → INCONSISTENTE apontando o elo 1', async () => {
    const elos = await cadeiaComTresElos(auditoria);
    elos[0] = { ...elos[0], payload: { ...elos[0].payload, valor: 320 } };

    expect(auditoria.verificarElos(elos)).toMatchObject({
      status: 'INCONSISTENTE',
      eloInconsistente: 1,
      motivo: 'HASH_DIVERGENTE',
    });
  });

  it('autor trocado no elo 3 → aponta o elo 3', async () => {
    const elos = await cadeiaComTresElos(auditoria);
    elos[2] = { ...elos[2], authorId: 'ana' };

    expect(auditoria.verificarElos(elos)).toMatchObject({ eloInconsistente: 3, motivo: 'HASH_DIVERGENTE' });
  });

  it('elo removido do meio → aponta a quebra de sequência', async () => {
    const elos = await cadeiaComTresElos(auditoria);
    const semElo2 = [elos[0], elos[2]];

    expect(auditoria.verificarElos(semElo2)).toMatchObject({
      eloInconsistente: 2,
      motivo: 'SEQUENCIA_QUEBRADA',
    });
  });

  it('hash recalculado pelo invasor no elo 2 quebra o encadeamento do elo 3', async () => {
    const elos = await cadeiaComTresElos(auditoria);
    const payloadAdulterado = { motivo: 'outro texto' };
    const hashForjado = auditoria.computeSha256Hash({
      hashAnterior: elos[1].hashAnterior,
      timestampUtc: elos[1].timestampUtc,
      authorId: elos[1].authorId,
      tipoEvento: elos[1].tipoEvento,
      payload: payloadAdulterado,
    });
    elos[1] = { ...elos[1], payload: payloadAdulterado, hashAtual: hashForjado };

    expect(auditoria.verificarElos(elos)).toMatchObject({
      eloInconsistente: 3,
      motivo: 'ENCADEAMENTO_QUEBRADO',
    });
  });

  it('elos já gravados não são sobrescritos: eventos simultâneos ganham sequências distintas', async () => {
    await Promise.all([
      auditoria.recordEvent({ tenantId: TENANT, requestId: 'sol-x', tipoEvento: 'BLOQUEIO_SOD', authorId: 'a', payload: {} }),
      auditoria.recordEvent({ tenantId: TENANT, requestId: 'sol-x', tipoEvento: 'BLOQUEIO_SOD', authorId: 'b', payload: {} }),
    ]);
    const elos = await auditoria.getAuditTrail(TENANT, 'sol-x');

    expect(elos.map((e) => e.sequencia)).toEqual([1, 2]);
    expect(auditoria.verificarElos(elos).status).toBe('INTEGRA');
  });
});
