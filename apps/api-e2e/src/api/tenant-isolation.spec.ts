import axios from 'axios';
import { SEED, TOKENS } from '../support/tokens';

/**
 * Isolamento entre empresas (RNF07 / US-15 / CA-16.1 e CA-16.2).
 * Garante que cada empresa opera estritamente no escopo de seu próprio tenant.
 */
const comToken = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
  validateStatus: () => true,
});

function idsDaListagem(dados: unknown): string[] {
  const itens = Array.isArray(dados) ? dados : ((dados as { items?: unknown[] })?.items ?? []);
  return (itens as Array<{ id: string }>).map((s) => s.id);
}

describe('Isolamento de tenant (RNF07)', () => {
  it('CA-16.1: empresa A abre a própria solicitação pelo ID, mas não a da empresa B (BUG-002)', async () => {
    // Controle: sem ele, um 404 de "rota inexistente" passaria como se fosse isolamento.
    const propria = await axios.get(`/api/solicitacoes/${SEED.solicitacaoA}`, comToken(TOKENS.solicitanteA));
    expect(propria.status).toBe(200);

    const deOutraEmpresa = await axios.get(`/api/solicitacoes/${SEED.solicitacaoB}`, comToken(TOKENS.solicitanteA));
    expect([403, 404]).toContain(deOutraEmpresa.status);
  });

  it('CA-16.2: listagem da empresa A traz a sua solicitação e não a da empresa B', async () => {
    // 1. Cria uma solicitação para a Empresa A para garantir presença determinística na primeira página
    const criacao = await axios.post(
      '/api/solicitacoes',
      {
        centroCustoId: SEED.centroCustoA,
        valor: 1500,
        categoria: 'SERVICOS_TERCEIROS',
        justificativa: 'Solicitação da Empresa A para teste de isolamento na listagem (CA-16.2)',
      },
      comToken(TOKENS.solicitanteA),
    );
    expect(criacao.status).toBe(201);
    const idMinhaSolicitacaoA = criacao.data.id;

    // 2. Consulta a primeira página padrão da Empresa A (sem filtros especiais)
    const res = await axios.get('/api/solicitacoes', comToken(TOKENS.solicitanteA));
    expect(res.status).toBe(200);
    const ids = idsDaListagem(res.data);

    // 3. Asserções rigorosas de isolamento
    expect(ids).toContain(idMinhaSolicitacaoA);
    expect(ids).not.toContain(SEED.solicitacaoB);

    // Validação extra: 100% dos registros retornados pertencem ao tenant da Empresa A
    const itens = Array.isArray(res.data) ? res.data : ((res.data as { items?: unknown[] })?.items ?? []);
    expect(itens.every((s: { tenantId?: string }) => !s.tenantId || s.tenantId === SEED.tenantA)).toBe(true);
  });

  it('CA-16.2: listagem da empresa B traz a sua solicitação e não a da empresa A', async () => {
    // 1. Cria uma solicitação para a Empresa B para garantir presença determinística na primeira página
    const criacao = await axios.post(
      '/api/solicitacoes',
      {
        centroCustoId: SEED.centroCustoB,
        valor: 1200,
        categoria: 'SERVICOS_TERCEIROS',
        justificativa: 'Solicitação da Empresa B para teste de isolamento na listagem (CA-16.2)',
      },
      comToken(TOKENS.solicitanteB),
    );
    expect(criacao.status).toBe(201);
    const idMinhaSolicitacaoB = criacao.data.id;

    // 2. Consulta a primeira página padrão da Empresa B
    const res = await axios.get('/api/solicitacoes', comToken(TOKENS.solicitanteB));
    expect(res.status).toBe(200);
    const ids = idsDaListagem(res.data);

    // 3. Asserções rigorosas de isolamento
    expect(ids).toContain(idMinhaSolicitacaoB);
    expect(ids).not.toContain(SEED.solicitacaoA);

    // Validação extra: 100% dos registros retornados pertencem ao tenant da Empresa B
    const itens = Array.isArray(res.data) ? res.data : ((res.data as { items?: unknown[] })?.items ?? []);
    expect(itens.every((s: { tenantId?: string }) => !s.tenantId || s.tenantId === SEED.tenantB)).toBe(true);
  });

  it('CA-16.3: empresa A lê a própria trilha, mas não a da solicitação da empresa B', async () => {
    const propria = await axios.get(`/api/solicitacoes/${SEED.solicitacaoA}/trilha`, comToken(TOKENS.gerenteA));
    expect(propria.status).toBe(200);

    const deOutraEmpresa = await axios.get(`/api/solicitacoes/${SEED.solicitacaoB}/trilha`, comToken(TOKENS.gerenteA));
    expect([403, 404]).toContain(deOutraEmpresa.status);
  });
});
