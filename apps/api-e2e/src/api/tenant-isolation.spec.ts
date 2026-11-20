import axios from 'axios';
import { SEED, TOKENS } from '../support/tokens';

/**
 * Isolamento entre empresas (RNF07 / US-15 / CA-16.1 e CA-16.2) com as solicitações do seed:
 * `sol-startop-01` (empresa A) e `sol-empresa-b-01` (empresa B).
 */
const comToken = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
  validateStatus: () => true,
});

function idsDaListagem(dados: unknown): string[] {
  const itens = Array.isArray(dados) ? dados : ((dados as { items?: unknown[] })?.items ?? []);
  return (itens as Array<{ id: string }>).map((s) => s.id);
}

async function idsDeTodasAsPaginas(token: string): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  while (page <= 10) {
    const res = await axios.get(`/api/solicitacoes?page=${page}&limit=50`, comToken(token));
    if (res.status !== 200) break;
    const items = idsDaListagem(res.data);
    if (!items.length) break;
    ids.push(...items);
    if (items.length < 50) break;
    page++;
  }
  return ids;
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
    const res = await axios.get('/api/solicitacoes', comToken(TOKENS.solicitanteA));
    expect(res.status).toBe(200);
    let ids = idsDaListagem(res.data);
    if (!ids.includes(SEED.solicitacaoA)) {
      // Quando outros testes (ex: ep-bva) criam muitas solicitações no tenant startop,
      // a solicitação inicial do seed pode ser empurrada para páginas posteriores devido à paginação (limit=20).
      ids = await idsDeTodasAsPaginas(TOKENS.solicitanteA);
    }
    expect(ids).toContain(SEED.solicitacaoA);
    expect(ids).not.toContain(SEED.solicitacaoB);
  });

  it('CA-16.2: listagem da empresa B traz a sua solicitação e não a da empresa A', async () => {
    const res = await axios.get('/api/solicitacoes', comToken(TOKENS.solicitanteB));
    expect(res.status).toBe(200);
    let ids = idsDaListagem(res.data);
    if (!ids.includes(SEED.solicitacaoB)) {
      ids = await idsDeTodasAsPaginas(TOKENS.solicitanteB);
    }
    expect(ids).toContain(SEED.solicitacaoB);
    expect(ids).not.toContain(SEED.solicitacaoA);
  });

  it('CA-16.3: empresa A lê a própria trilha, mas não a da solicitação da empresa B', async () => {
    const propria = await axios.get(`/api/solicitacoes/${SEED.solicitacaoA}/trilha`, comToken(TOKENS.gerenteA));
    expect(propria.status).toBe(200);

    const deOutraEmpresa = await axios.get(`/api/solicitacoes/${SEED.solicitacaoB}/trilha`, comToken(TOKENS.gerenteA));
    expect([403, 404]).toContain(deOutraEmpresa.status);
  });
});
