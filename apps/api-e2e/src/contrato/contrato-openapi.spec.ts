import axios, { AxiosRequestConfig } from 'axios';
import jestOpenAPI from 'jest-openapi';
import * as path from 'path';

jestOpenAPI(path.resolve(__dirname, '../../contrato/openapi.yaml'));

function criarTokenTeste(payload: {
  uid: string;
  tenantId: string;
  role: string;
  level?: string;
  maxApprovalLimit?: number;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      roles: [payload.role],
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');
  return `${header}.${body}.signature`;
}

const TOKEN_SOLICITANTE = criarTokenTeste({
  uid: 'usr-solicitante-contrato',
  tenantId: 'startop',
  role: 'SOLICITANTE',
});

const TOKEN_APROVADOR_N1 = criarTokenTeste({
  uid: 'usr-coord-contrato',
  tenantId: 'startop',
  role: 'APROVADOR_N1',
  level: 'N1',
  maxApprovalLimit: 1000,
});

function comToken(token?: string): AxiosRequestConfig {
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
  };
}

const corpoValido = {
  centroCustoId: 'cc-clinica-centro',
  valor: 500,
  categoria: 'MATERIAL_ESCRITORIO',
  justificativa: 'Compra de material de escritório para o teste de contrato',
  fornecedor: 'Papelaria Central LTDA',
};

async function criarSolicitacao(corpo: Record<string, unknown> = corpoValido): Promise<string> {
  const res = await axios.post('/api/solicitacoes', corpo, comToken(TOKEN_SOLICITANTE));
  if (res.status !== 201) {
    throw new Error(`Pré-condição falhou: criação retornou ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.id;
}

describe('Contrato OpenAPI v0.1', () => {
  describe('POST /solicitacoes', () => {
    it('201 — solicitação válida segue SolicitacaoResponseDto', async () => {
      const res = await axios.post('/api/solicitacoes', corpoValido, comToken(TOKEN_SOLICITANTE));
      expect(res.status).toBe(201);
      expect(res).toSatisfyApiSpec();
    });

    it('201 — solicitação sem fornecedor (campo opcional) segue SolicitacaoResponseDto', async () => {
      const semFornecedor = { ...corpoValido, fornecedor: undefined };
      const res = await axios.post('/api/solicitacoes', semFornecedor, comToken(TOKEN_SOLICITANTE));
      expect(res.status).toBe(201);
      expect(res).toSatisfyApiSpec();
    });

    it('400 — valor zero segue ErrorResponse', async () => {
      const res = await axios.post(
        '/api/solicitacoes',
        { ...corpoValido, valor: 0 },
        comToken(TOKEN_SOLICITANTE),
      );
      expect(res.status).toBe(400);
      expect(res).toSatisfyApiSpec();
    });

    it('401 — sem token segue ErrorResponse', async () => {
      const res = await axios.post('/api/solicitacoes', corpoValido, comToken());
      expect(res.status).toBe(401);
      expect(res).toSatisfyApiSpec();
    });
  });

  describe('GET /solicitacoes', () => {
    it('200 — listagem é um array de SolicitacaoResponseDto', async () => {
      await criarSolicitacao();
      const res = await axios.get('/api/solicitacoes', comToken(TOKEN_SOLICITANTE));
      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
    });

    it('401 — sem token segue ErrorResponse', async () => {
      const res = await axios.get('/api/solicitacoes', comToken());
      expect(res.status).toBe(401);
      expect(res).toSatisfyApiSpec();
    });
  });

  describe('GET /solicitacoes/{id}', () => {
    it('200 — solicitante consulta a própria solicitação', async () => {
      const id = await criarSolicitacao();
      const res = await axios.get(`/api/solicitacoes/${id}`, comToken(TOKEN_SOLICITANTE));
      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
    });
  });

  describe('POST /solicitacoes/{id}/aprovar', () => {
    let id: string;

    beforeAll(async () => {
      id = await criarSolicitacao();
    });

    it('200 — aprovação segue SolicitacaoResponseDto', async () => {
      const res = await axios.post(
        `/api/solicitacoes/${id}/aprovar`,
        { versao: 1, observacao: 'Aprovado no teste de contrato' },
        comToken(TOKEN_APROVADOR_N1),
      );
      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
    });

    it('409 — versão desatualizada segue ErrorResponse', async () => {
      const res = await axios.post(
        `/api/solicitacoes/${id}/aprovar`,
        { versao: 1 },
        comToken(TOKEN_APROVADOR_N1),
      );
      expect(res.status).toBe(409);
      expect(res).toSatisfyApiSpec();
    });

    it('403 — solicitante não pode aprovar, segue ErrorResponse', async () => {
      const outro = await criarSolicitacao();
      const res = await axios.post(
        `/api/solicitacoes/${outro}/aprovar`,
        { versao: 1 },
        comToken(TOKEN_SOLICITANTE),
      );
      expect(res.status).toBe(403);
      expect(res).toSatisfyApiSpec();
    });

    it('401 — sem token segue ErrorResponse', async () => {
      const res = await axios.post(`/api/solicitacoes/${id}/aprovar`, { versao: 1 }, comToken());
      expect(res.status).toBe(401);
      expect(res).toSatisfyApiSpec();
    });
  });

  describe('POST /solicitacoes/{id}/rejeitar', () => {
    let id: string;

    beforeAll(async () => {
      id = await criarSolicitacao();
    });

    it('400 — motivo com menos de 10 caracteres segue ErrorResponse', async () => {
      const res = await axios.post(
        `/api/solicitacoes/${id}/rejeitar`,
        { versao: 1, motivo: 'curto' },
        comToken(TOKEN_APROVADOR_N1),
      );
      expect(res.status).toBe(400);
      expect(res).toSatisfyApiSpec();
    });

    it('200 — rejeição segue SolicitacaoResponseDto', async () => {
      const res = await axios.post(
        `/api/solicitacoes/${id}/rejeitar`,
        { versao: 1, motivo: 'Valor fora do orçamento previsto para o trimestre' },
        comToken(TOKEN_APROVADOR_N1),
      );
      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
    });

    it('409 — rejeitar solicitação já encerrada segue ErrorResponse', async () => {
      const res = await axios.post(
        `/api/solicitacoes/${id}/rejeitar`,
        { versao: 2, motivo: 'Segunda tentativa de rejeição do pedido' },
        comToken(TOKEN_APROVADOR_N1),
      );
      expect(res.status).toBe(409);
      expect(res).toSatisfyApiSpec();
    });
  });

  describe('POST /solicitacoes/{id}/ajuste', () => {
    it('200 — pedido de ajuste segue SolicitacaoResponseDto', async () => {
      const id = await criarSolicitacao();
      const res = await axios.post(
        `/api/solicitacoes/${id}/ajuste`,
        { versao: 1, motivo: 'Favor anexar os orçamentos comparativos' },
        comToken(TOKEN_APROVADOR_N1),
      );
      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
    });

    it('403 — solicitante não pode pedir ajuste (status precisa estar no contrato)', async () => {
      const id = await criarSolicitacao();
      const res = await axios.post(
        `/api/solicitacoes/${id}/ajuste`,
        { versao: 1, motivo: 'Tentativa indevida de ajuste' },
        comToken(TOKEN_SOLICITANTE),
      );
      expect(res.status).toBe(403);
      expect(res).toSatisfyApiSpec();
    });
  });

  describe('PUT /solicitacoes/{id} (reenvio após ajuste)', () => {
    it('200 — reenvio está descrito no contrato', async () => {
      const id = await criarSolicitacao();
      await axios.post(
        `/api/solicitacoes/${id}/ajuste`,
        { versao: 1, motivo: 'Favor anexar os orçamentos comparativos' },
        comToken(TOKEN_APROVADOR_N1),
      );
      const res = await axios.put(
        `/api/solicitacoes/${id}`,
        { justificativa: 'Compra com três orçamentos comparativos anexados ao pedido' },
        comToken(TOKEN_SOLICITANTE),
      );
      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
    });
  });

  describe('Trilha de auditoria', () => {
    let id: string;

    beforeAll(async () => {
      id = await criarSolicitacao();
    });

    it('GET /trilha 200 — lista de EloAuditoriaDto', async () => {
      const res = await axios.get(`/api/solicitacoes/${id}/trilha`, comToken(TOKEN_APROVADOR_N1));
      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
    });

    it('GET /trilha 401 — sem token segue ErrorResponse', async () => {
      const res = await axios.get(`/api/solicitacoes/${id}/trilha`, comToken());
      expect(res.status).toBe(401);
      expect(res).toSatisfyApiSpec();
    });

    it('POST /trilha/verificar 200 — segue VerificacaoTrilhaResponseDto', async () => {
      const res = await axios.post(
        `/api/solicitacoes/${id}/trilha/verificar`,
        {},
        comToken(TOKEN_APROVADOR_N1),
      );
      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
    });

    it('GET /trilha/exportar 200 — exportação em JSON', async () => {
      const res = await axios.get(
        `/api/solicitacoes/${id}/trilha/exportar?formato=json`,
        comToken(TOKEN_APROVADOR_N1),
      );
      expect(res.status).toBe(200);
      expect(res).toSatisfyApiSpec();
    });
  });
});
