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

describe('Isolamento de tenant (RNF07)', () => {
  let idSolicitacaoEmpresaB = 'sol-empresa-b-01';
  let idSolicitacaoStartop = 'sol-startop-01';

  beforeAll(async () => {
    // Garante que exista solicitação criada para a Empresa B via API
    try {
      const resB = await axios.post(
        '/api/solicitacoes',
        {
          centroCustoId: 'cc-empresab-01',
          valor: 500,
          categoria: 'SERVICOS_TERCEIROS',
          justificativa: 'Consultoria técnica externa para teste de isolamento Empresa B',
        },
        {
          headers: { Authorization: `Bearer ${TOKEN_EMPRESA_B}` },
          validateStatus: () => true,
        },
      );
      if (resB.data && resB.data.id) {
        idSolicitacaoEmpresaB = resB.data.id;
      }
    } catch {
      // Ignora e usa o identificador fallback
    }

    // Garante que exista solicitação criada para a Startop via API
    try {
      const resA = await axios.post(
        '/api/solicitacoes',
        {
          centroCustoId: 'cc-startop-01',
          valor: 800,
          categoria: 'MATERIAL_ESCRITORIO',
          justificativa: 'Material operacional para teste de isolamento Startop',
        },
        {
          headers: { Authorization: `Bearer ${TOKEN_STARTOP}` },
          validateStatus: () => true,
        },
      );
      if (resA.data && resA.data.id) {
        idSolicitacaoStartop = resA.data.id;
      }
    } catch {
      // Ignora e usa o identificador fallback
    }
  });

  it('usuario da empresa A recebe 403 ou 404 ao acessar solicitacao da empresa B', async () => {
    const res = await axios.get(`/api/solicitacoes/${idSolicitacaoEmpresaB}`, {
      headers: { Authorization: `Bearer ${TOKEN_STARTOP}` },
      validateStatus: () => true,
    });
    expect([403, 404]).toContain(res.status);
  });

  it('usuario da Startop nao enxerga solicitacoes da Empresa B na listagem', async () => {
    const res = await axios.get('/api/solicitacoes', {
      headers: { Authorization: `Bearer ${TOKEN_STARTOP}` },
      validateStatus: () => true,
    });

    expect(res.status).toBe(200);
    const solicitacoes = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    const ids = solicitacoes.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(idSolicitacaoEmpresaB);
    expect(ids).toContain(idSolicitacaoStartop);
  });

  it('usuario da Empresa B enxerga apenas solicitacoes do seu proprio tenant', async () => {
    const res = await axios.get('/api/solicitacoes', {
      headers: { Authorization: `Bearer ${TOKEN_EMPRESA_B}` },
      validateStatus: () => true,
    });

    expect(res.status).toBe(200);
    const solicitacoes = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    const ids = solicitacoes.map((s: { id: string }) => s.id);
    expect(ids).toContain(idSolicitacaoEmpresaB);
    expect(ids).not.toContain(idSolicitacaoStartop);
  });
});
