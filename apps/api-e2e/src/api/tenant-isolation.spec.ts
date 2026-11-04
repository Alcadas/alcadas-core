import axios from 'axios';

function criarTokenTeste(payload: { uid: string; tenantId: string; role?: string; roles?: string[] }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');
  return `${header}.${body}.signature`;
}

const TOKEN_STARTOP = criarTokenTeste({
  uid: 'startop-solicitante-01',
  tenantId: 'startop',
  role: 'SOLICITANTE',
  roles: ['SOLICITANTE'],
});

const TOKEN_EMPRESA_B = criarTokenTeste({
  uid: 'empresab-solicitante-01',
  tenantId: 'empresa-b',
  role: 'SOLICITANTE',
  roles: ['SOLICITANTE'],
});

const ID_SOLICITACAO_EMPRESA_B = 'sol-empresa-b-01';
const ID_SOLICITACAO_STARTOP = 'sol-startop-01';

describe('Isolamento de tenant (RNF07)', () => {
  it('usuario da Startop nao enxerga solicitacoes da Empresa B na listagem', async () => {
    const res = await axios.get('/api/solicitacoes', {
      headers: { Authorization: `Bearer ${TOKEN_STARTOP}` },
      validateStatus: () => true,
    });

    expect(res.status).toBe(200);
    const solicitacoes = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    const ids = solicitacoes.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(ID_SOLICITACAO_EMPRESA_B);
  });

  it('usuario da Empresa B enxerga apenas solicitacoes do seu proprio tenant', async () => {
    const res = await axios.get('/api/solicitacoes', {
      headers: { Authorization: `Bearer ${TOKEN_EMPRESA_B}` },
      validateStatus: () => true,
    });

    expect(res.status).toBe(200);
    const solicitacoes = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    const ids = solicitacoes.map((s: { id: string }) => s.id);
    expect(ids).toContain(ID_SOLICITACAO_EMPRESA_B);
    expect(ids).not.toContain(ID_SOLICITACAO_STARTOP);
  });
});
