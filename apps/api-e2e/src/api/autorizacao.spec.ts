import axios, { AxiosRequestConfig, Method } from 'axios';
import { SEED, TOKENS } from '../support/tokens';

const corpoSolicitacao = {
  centroCustoId: SEED.centroCustoA,
  valor: 100,
  categoria: 'MATERIAL_ESCRITORIO',
  justificativa: 'Compra de material para o teste de autorização',
};
const corpoDecisao = { versao: 1, motivo: 'Motivo com mais de dez caracteres', observacao: 'Teste de autorização' };
const corpoCentroCusto = { name: 'Centro de custo do teste de autorização', code: 'CC-AUT' };
const corpoTetos = { tiers: [] };

// As funções de teste recebem `...[metodo, caminho, corpo]: Rota` (parâmetro rest): com três parâmetros
// nomeados, o Jest trataria o terceiro como o callback `done` nas linhas sem corpo (rotas GET).
type Rota = [metodo: Method, caminho: string, corpo?: object];

const ROTAS: Rota[] = [
  // Jornada 1 — configuração de centros de custo e alçadas (US-01)
  ['POST', '/api/centros-custo', corpoCentroCusto],
  ['GET', '/api/centros-custo'],
  ['POST', `/api/tenants/${SEED.tenantA}/cost-centers`, corpoCentroCusto],
  ['GET', `/api/tenants/${SEED.tenantA}/cost-centers`],
  ['PUT', '/api/alcadas/tetos', corpoTetos],
  ['POST', '/api/alcadas/tetos', corpoTetos],
  ['GET', '/api/alcadas/tetos'],
  ['PUT', `/api/tenants/${SEED.tenantA}/tiers`, corpoTetos],
  ['GET', `/api/tenants/${SEED.tenantA}/tiers`],
  ['POST', '/api/alcadas/validar-decisao', { valor: 100 }],
  // Jornada 2 — submissão (US-02)
  ['POST', '/api/solicitacoes', corpoSolicitacao],
  ['GET', '/api/solicitacoes'],
  // Jornada 3 — decisão (US-03 a US-05), sobre a solicitação do seed
  ['POST', `/api/solicitacoes/${SEED.solicitacaoA}/aprovar`, corpoDecisao],
  ['POST', `/api/solicitacoes/${SEED.solicitacaoA}/rejeitar`, corpoDecisao],
  ['POST', `/api/solicitacoes/${SEED.solicitacaoA}/ajuste`, corpoDecisao],
];

function chamar(metodo: Method, caminho: string, token?: string, corpo?: object, cabecalhos: Record<string, string> = {}) {
  const config: AxiosRequestConfig = {
    method: metodo,
    url: caminho,
    data: corpo,
    headers: { ...cabecalhos, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    validateStatus: () => true,
  };
  return axios.request(config);
}

describe('[CP2] Autorização — jornadas 1 a 3', () => {
  describe.each(ROTAS)('%s %s', (metodo, caminho, corpo) => {
    it.each([
      ['sem token', undefined],
      ['token vencido', TOKENS.vencido],
      ['token malformado', TOKENS.malformado],
    ])('barra %s com 401', async (_cenario, token) => {
      const res = await chamar(metodo, caminho, token, corpo);
      expect(res.status).toBe(401);
      expect(res.data).toMatchObject({ statusCode: 401 });
    });
  });

  describe('papel errado (Solicitante em rota restrita) → 403', () => {
    it.each(
      ROTAS.filter(([metodo, caminho]) =>
        [
          'POST /api/centros-custo',
          `POST /api/tenants/${SEED.tenantA}/cost-centers`,
          'PUT /api/alcadas/tetos',
          'POST /api/alcadas/tetos',
          `PUT /api/tenants/${SEED.tenantA}/tiers`,
          'POST /api/alcadas/validar-decisao',
          `POST /api/solicitacoes/${SEED.solicitacaoA}/aprovar`,
          `POST /api/solicitacoes/${SEED.solicitacaoA}/rejeitar`,
          `POST /api/solicitacoes/${SEED.solicitacaoA}/ajuste`,
        ].includes(`${metodo} ${caminho}`),
      ),
    )('%s %s', async (...[metodo, caminho, corpo]: Rota) => {
      const res = await chamar(metodo, caminho, TOKENS.solicitanteA, corpo);
      expect(res.status).toBe(403);
    });
  });

  describe('tenant errado (usuário da empresa B na empresa A) → 403 ou 404', () => {
    it.each<Rota>([
      ['POST', `/api/tenants/${SEED.tenantA}/cost-centers`, corpoCentroCusto],
      ['GET', `/api/tenants/${SEED.tenantA}/cost-centers`],
      ['PUT', `/api/tenants/${SEED.tenantA}/tiers`, corpoTetos],
      ['GET', `/api/tenants/${SEED.tenantA}/tiers`],
    ])('admin da empresa B em %s %s', async (...[metodo, caminho, corpo]: Rota) => {
      const res = await chamar(metodo, caminho, TOKENS.adminB, corpo);
      expect(res.status).toBe(403);
    });

    it.each(['aprovar', 'rejeitar', 'ajuste'])(
      'gerente da empresa B tenta %s a solicitação da empresa A (CA-16.1)',
      async (acao) => {
        const res = await chamar('POST', `/api/solicitacoes/${SEED.solicitacaoA}/${acao}`, TOKENS.gerenteB, corpoDecisao);
        expect([403, 404]).toContain(res.status);
      },
    );

    it('GET /api/centros-custo: empresa B não vê os centros de custo da empresa A', async () => {
      const res = await chamar('GET', '/api/centros-custo', TOKENS.solicitanteB);
      expect(res.status).toBe(200);
      const ids = (res.data as Array<{ id: string }>).map((c) => c.id);
      expect(ids).toContain(SEED.centroCustoB);
      expect(ids).not.toContain(SEED.centroCustoA);
    });

    it('GET /api/centros-custo: cabeçalho x-tenant-id forjado é ignorado', async () => {
      const res = await chamar('GET', '/api/centros-custo', TOKENS.solicitanteA, undefined, {
        'x-tenant-id': SEED.tenantB,
      });
      expect(res.status).toBe(200);
      const ids = (res.data as Array<{ id: string }>).map((c) => c.id);
      expect(ids).not.toContain(SEED.centroCustoB);
    });

    it('POST /api/solicitacoes: tenantId da empresa B no corpo é ignorado', async () => {
      const res = await chamar('POST', '/api/solicitacoes', TOKENS.solicitanteA, {
        ...corpoSolicitacao,
        tenantId: SEED.tenantB,
      });
      expect(res.status).toBe(201);
      expect(res.data.tenantId).toBe(SEED.tenantA);
    });
  });

  describe('acesso a recurso de outra área (centro de custo) → 403', () => {
    it.each(['aprovar', 'rejeitar', 'ajuste'])(
      'gerente de cc-startop-02 tenta %s solicitação de cc-startop-01',
      async (acao) => {
        const res = await chamar(
          'POST',
          `/api/solicitacoes/${SEED.solicitacaoA}/${acao}`,
          TOKENS.gerenteOutraArea,
          corpoDecisao,
        );
        expect(res.status).toBe(403);
      },
    );

    it('solicitante de cc-startop-02 tenta criar solicitação para cc-startop-01', async () => {
      const res = await chamar('POST', '/api/solicitacoes', TOKENS.solicitanteOutraArea, corpoSolicitacao);
      expect(res.status).toBe(403);
    });
  });
});
