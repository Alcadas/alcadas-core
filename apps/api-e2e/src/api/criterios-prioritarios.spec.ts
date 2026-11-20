import axios from 'axios';

function criarToken(claims: Record<string, unknown> & { role: string }): string {
  const base64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = { ...claims, roles: [claims.role], exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${base64({ alg: 'none', typ: 'JWT' })}.${base64(payload)}.assinatura`;
}

const TENANT = 'startop';
const CENTRO_CUSTO = 'cc-startop-01';

const TOKENS = {
  solicitante: criarToken({ uid: 'criterios-solicitante', tenantId: TENANT, role: 'SOLICITANTE' }),
  coordenadorN1: criarToken({
    uid: 'criterios-coordenador',
    tenantId: TENANT,
    role: 'APROVADOR_N1',
    level: 'N1',
    maxApprovalLimit: 1000,
  }),
  gerenteN2: criarToken({
    uid: 'criterios-gerente',
    tenantId: TENANT,
    role: 'APROVADOR_N2',
    level: 'N2',
    maxApprovalLimit: 5000,
  }),
  /** Gerente com teto pessoal de R$ 3.000,00, abaixo do valor do pedido usado no CA-03.1. */
  gerenteTetoBaixo: criarToken({
    uid: 'criterios-gerente-teto-baixo',
    tenantId: TENANT,
    role: 'APROVADOR_N2',
    level: 'N2',
    maxApprovalLimit: 3000,
  }),
};

const comToken = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
  validateStatus: () => true,
});

const corpoValido = {
  centroCustoId: CENTRO_CUSTO,
  valor: 400,
  categoria: 'MATERIAL_ESCRITORIO',
  justificativa: 'Compra de material para o teste dos critérios prioritários',
};

async function criarSolicitacao(token: string, corpo: object = corpoValido) {
  const res = await axios.post('/api/solicitacoes', corpo, comToken(token));
  if (res.status !== 201) {
    throw new Error(`Pré-condição falhou: criação retornou ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data as { id: string; versao: number; status: string };
}

describe('[CP2] Critérios prioritários — US-01 a US-05', () => {
  describe('US-02 — Criar solicitação', () => {
    it.each(['centroCustoId', 'valor', 'categoria', 'justificativa'])(
      'CA-02.1: sem o campo obrigatório "%s" → 400, nenhuma solicitação criada e o campo é indicado',
      async (campo) => {
        const corpo: Record<string, unknown> = { ...corpoValido };
        delete corpo[campo];

        const res = await axios.post('/api/solicitacoes', corpo, comToken(TOKENS.solicitante));
        expect(res.status).toBe(400);
        expect(res.data.id).toBeUndefined();
        expect(JSON.stringify(res.data).toLowerCase()).toContain(campo.toLowerCase());
      },
    );
  });

  describe('US-03 — Decidir dentro da alçada', () => {
    it('CA-03.1: valor acima do teto do aprovador → 403 e o status não muda', async () => {
      // R$ 4.000,00 segue o fluxo de 2 etapas: N1 aprova a etapa 1 e a etapa 2 é do Gerente (N2).
      const criada = await criarSolicitacao(TOKENS.solicitante, { ...corpoValido, valor: 4000 });
      const etapa1 = await axios.post(
        `/api/solicitacoes/${criada.id}/aprovar`,
        { versao: criada.versao },
        comToken(TOKENS.coordenadorN1),
      );
      expect(etapa1.status).toBe(200);

      const acimaDoTeto = await axios.post(
        `/api/solicitacoes/${criada.id}/aprovar`,
        { versao: etapa1.data.versao },
        comToken(TOKENS.gerenteTetoBaixo),
      );
      expect(acimaDoTeto.status).toBe(403);

      // Se o status e a versão não mudaram, um Gerente com teto suficiente ainda decide com a mesma versão.
      const dentroDoTeto = await axios.post(
        `/api/solicitacoes/${criada.id}/aprovar`,
        { versao: etapa1.data.versao },
        comToken(TOKENS.gerenteN2),
      );
      expect(dentroDoTeto.status).toBe(200);
      expect(dentroDoTeto.data.status).toBe('APROVADA');
    });
  });

  describe('US-04 — Segregação de funções (SoD)', () => {
    it('CA-04.1 / CA-04.3: aprovador que criou o pedido não aprova → 403 e a trilha registra BLOQUEIO_SOD', async () => {
      const criada = await criarSolicitacao(TOKENS.coordenadorN1);

      const res = await axios.post(
        `/api/solicitacoes/${criada.id}/aprovar`,
        { versao: criada.versao },
        comToken(TOKENS.coordenadorN1),
      );
      expect(res.status).toBe(403);

      const trilha = await axios.get(`/api/solicitacoes/${criada.id}/trilha`, comToken(TOKENS.coordenadorN1));
      expect(trilha.status).toBe(200);
      const bloqueios = (trilha.data as Array<{ tipoEvento: string; authorId: string }>).filter(
        (elo) => elo.tipoEvento === 'BLOQUEIO_SOD',
      );
      expect(bloqueios).toHaveLength(1);
      expect(bloqueios[0].authorId).toBe('criterios-coordenador');
    });

    it.todo('CA-04.2: substituto com delegação ativa não aprova o próprio pedido (depende da delegação, US-10)');
  });
});
