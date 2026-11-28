import axios from 'axios';

function criarToken(claims: Record<string, unknown> & { role: string }): string {
  const base64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = { ...claims, roles: [claims.role], exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${base64({ alg: 'none', typ: 'JWT' })}.${base64(payload)}.assinatura`;
}

const TENANT = 'startop';
const CENTRO_CUSTO = 'cc-startop-01';

const TOKENS = {
  solicitante: criarToken({ uid: 'ep-bva-solicitante', tenantId: TENANT, role: 'SOLICITANTE' }),
  coordenadorN1: criarToken({
    uid: 'ep-bva-coordenador-1',
    tenantId: TENANT,
    role: 'APROVADOR_N1',
    level: 'N1',
    maxApprovalLimit: 1000,
  }),
  outroCoordenadorN1: criarToken({
    uid: 'ep-bva-coordenador-2',
    tenantId: TENANT,
    role: 'APROVADOR_N1',
    level: 'N1',
    maxApprovalLimit: 1000,
  }),
  gerenteN2: criarToken({
    uid: 'ep-bva-gerente',
    tenantId: TENANT,
    role: 'APROVADOR_N2',
    level: 'N2',
    maxApprovalLimit: 5000,
  }),
  diretorCfo: criarToken({
    uid: 'ep-bva-diretor',
    tenantId: TENANT,
    role: 'DIRETOR_CFO',
    level: 'N3',
    maxApprovalLimit: null,
  }),
};

const comToken = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
  validateStatus: () => true,
});

const JUSTIFICATIVA_LONGA = 'Justificativa detalhada para o teste de valor limite da suíte EP/BVA';

interface Solicitacao {
  id: string;
  status: string;
  versao: number;
  etapaAtual?: number;
  totalEtapas?: number;
  aprovadorEsperadoPapel?: string;
}

async function criarSolicitacao(
  valor: number,
  categoria = 'MATERIAL_ESCRITORIO',
  justificativa = JUSTIFICATIVA_LONGA,
): Promise<Solicitacao> {
  const res = await axios.post(
    '/api/solicitacoes',
    { centroCustoId: CENTRO_CUSTO, valor, categoria, justificativa },
    comToken(TOKENS.solicitante),
  );
  if (res.status !== 201) {
    throw new Error(`Pré-condição falhou: criação retornou ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

function decidir(id: string, acao: 'aprovar' | 'rejeitar' | 'ajuste', token: string, corpo: object) {
  return axios.post(`/api/solicitacoes/${id}/${acao}`, corpo, comToken(token));
}

/** Leva a solicitação até a etapa do Gerente (N2): o Coordenador (N1) aprova a etapa 1. */
async function avancarAteGerente(valor: number): Promise<Solicitacao> {
  const criada = await criarSolicitacao(valor, 'EQUIPAMENTOS');
  const etapa1 = await decidir(criada.id, 'aprovar', TOKENS.coordenadorN1, { versao: criada.versao });
  if (etapa1.status !== 200) {
    throw new Error(`Pré-condição falhou: etapa 1 retornou ${etapa1.status} ${JSON.stringify(etapa1.data)}`);
  }
  return etapa1.data;
}

describe('[CP2] EP/BVA — US-01 a US-05', () => {
  describe('CT-01 — Teto do Gerente R$ 5.000,00 (CA-01.2)', () => {
    it.each([
      ['abaixo do teto', 4999.99],
      ['igual ao teto', 5000],
    ])('CT-01: %s (R$ %s) → Gerente aprova e a solicitação fica APROVADA', async (_rotulo, valor) => {
      const naEtapaDoGerente = await avancarAteGerente(valor);
      const res = await decidir(naEtapaDoGerente.id, 'aprovar', TOKENS.gerenteN2, {
        versao: naEtapaDoGerente.versao,
      });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('APROVADA');
    });

    it('CT-01: R$ 5.000,01 (acima do teto) → Gerente recebe 403 já na primeira tentativa, sem alterar status nem versão (CA-01.2 / #107)', async () => {
      const naEtapaDoGerente = await avancarAteGerente(5000.01);
      const res = await decidir(naEtapaDoGerente.id, 'aprovar', TOKENS.gerenteN2, {
        versao: naEtapaDoGerente.versao,
      });
      expect(res.status).toBe(403);
      expect(res.data).toMatchObject({ statusCode: 403 });

      const atual = await axios.get(`/api/solicitacoes/${naEtapaDoGerente.id}`, comToken(TOKENS.diretorCfo));
      expect(atual.status).toBe(200);
      expect(atual.data).toMatchObject({
        status: 'PENDENTE',
        versao: naEtapaDoGerente.versao,
      });
    });

    it('CT-01: R$ 5.000,01 (acima do teto) → após bloqueio do Gerente, pedido segue disponível para o Diretor/CFO aprovar (CA-01.2 / #107)', async () => {
      const naEtapaDoGerente = await avancarAteGerente(5000.01);
      const bloqueioGerente = await decidir(naEtapaDoGerente.id, 'aprovar', TOKENS.gerenteN2, {
        versao: naEtapaDoGerente.versao,
      });
      expect(bloqueioGerente.status).toBe(403);

      const aprovacaoDiretor = await decidir(naEtapaDoGerente.id, 'aprovar', TOKENS.diretorCfo, {
        versao: naEtapaDoGerente.versao,
      });
      expect(aprovacaoDiretor.status).toBe(200);
      expect(aprovacaoDiretor.data.status).toBe('APROVADA');
    });
  });

  describe('CT-02 — Valor da solicitação (CA-02.3)', () => {
    it.each([
      ['-1', 400, -1],
      ['0', 400, 0],
      ['0.01', 201, 0.01],
      ['10.123', 400, 10.123],
    ])('CT-02: valor %s → %s', async (_rotulo, esperado, valor) => {
      const res = await axios.post(
        '/api/solicitacoes',
        { centroCustoId: CENTRO_CUSTO, valor, categoria: 'MATERIAL_ESCRITORIO', justificativa: JUSTIFICATIVA_LONGA },
        comToken(TOKENS.solicitante),
      );
      expect(res.status).toBe(esperado);
    });
  });

  describe('CT-03 — Justificativa acima da base da categoria (CA-02.2)', () => {
    // Categoria EQUIPAMENTOS: base de R$ 5.000,00. Acima dela, a justificativa exige 30 caracteres.
    it.each([
      ['valor igual à base (5.000,00) com justificativa de 10 caracteres', 201, 5000, 10],
      ['valor acima da base (5.000,01) com justificativa de 29 caracteres', 400, 5000.01, 29],
      ['valor acima da base (5.000,01) com justificativa de 30 caracteres', 201, 5000.01, 30],
    ])('CT-03: %s → %s', async (_rotulo, esperado, valor, tamanho) => {
      const res = await axios.post(
        '/api/solicitacoes',
        { centroCustoId: CENTRO_CUSTO, valor, categoria: 'EQUIPAMENTOS', justificativa: 'x'.repeat(tamanho) },
        comToken(TOKENS.solicitante),
      );
      expect(res.status).toBe(esperado);
    });
  });

  describe('CT-04 — Motivo de rejeição e de ajuste (CA-03.2)', () => {
    it.each([
      ['rejeitar', 9, 400],
      ['rejeitar', 10, 200],
      ['ajuste', 9, 400],
      ['ajuste', 10, 200],
    ] as const)('CT-04: %s com motivo de %s caracteres → %s', async (acao, tamanho, esperado) => {
      const criada = await criarSolicitacao(500);
      const res = await decidir(criada.id, acao, TOKENS.coordenadorN1, {
        versao: criada.versao,
        motivo: 'x'.repeat(tamanho),
      });
      expect(res.status).toBe(esperado);
    });
  });

  describe('CT-05 — Janela de 30 dias (CA-06.2)', () => {
    it.todo('CT-05: pedido anterior há 30 / 31 dias → bloqueia / não bloqueia (US-06, fora do escopo do CP2)');
  });

  describe('CT-06 — Transição de estado inválida (CA-03.4)', () => {
    it('CT-06: aprovar uma solicitação já APROVADA → 409', async () => {
      const criada = await criarSolicitacao(500);
      const aprovada = await decidir(criada.id, 'aprovar', TOKENS.coordenadorN1, { versao: criada.versao });
      expect(aprovada.data.status).toBe('APROVADA');

      const res = await decidir(criada.id, 'aprovar', TOKENS.coordenadorN1, { versao: aprovada.data.versao });
      expect(res.status).toBe(409);
    });

    it('CT-06: rejeitar uma solicitação já REJEITADA → 409', async () => {
      const criada = await criarSolicitacao(500);
      const rejeitada = await decidir(criada.id, 'rejeitar', TOKENS.coordenadorN1, {
        versao: criada.versao,
        motivo: 'Fora do orçamento do trimestre',
      });
      expect(rejeitada.data.status).toBe('REJEITADA');

      const res = await decidir(criada.id, 'rejeitar', TOKENS.coordenadorN1, {
        versao: rejeitada.data.versao,
        motivo: 'Segunda tentativa de rejeição',
      });
      expect(res.status).toBe(409);
    });

    it('CT-06: pedir ajuste em uma solicitação já APROVADA → 409', async () => {
      const criada = await criarSolicitacao(500);
      const aprovada = await decidir(criada.id, 'aprovar', TOKENS.coordenadorN1, { versao: criada.versao });
      expect(aprovada.data.status).toBe('APROVADA');

      const res = await decidir(criada.id, 'ajuste', TOKENS.coordenadorN1, {
        versao: aprovada.data.versao,
        motivo: 'Favor anexar os orçamentos',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('CT-07 — Concorrência (US-05)', () => {
    it('CT-07: duas aprovações simultâneas com a mesma versão → uma 200 e uma 409 (CA-05.1)', async () => {
      const criada = await criarSolicitacao(500);
      const respostas = await Promise.all([
        decidir(criada.id, 'aprovar', TOKENS.coordenadorN1, { versao: criada.versao }),
        decidir(criada.id, 'aprovar', TOKENS.outroCoordenadorN1, { versao: criada.versao }),
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it(
      'CT-07: 20 pares simultâneos → cada par com exatamente 1 decisão gravada na trilha (CA-05.2)',
      async () => {
        const PARES = 20;
        for (let par = 0; par < PARES; par++) {
          const criada = await criarSolicitacao(500);
          const respostas = await Promise.all([
            decidir(criada.id, 'aprovar', TOKENS.coordenadorN1, { versao: criada.versao }),
            decidir(criada.id, 'aprovar', TOKENS.outroCoordenadorN1, { versao: criada.versao }),
          ]);
          expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);

          const trilha = await axios.get(`/api/solicitacoes/${criada.id}/trilha`, comToken(TOKENS.coordenadorN1));
          const aprovacoes = (trilha.data as Array<{ tipoEvento: string }>).filter(
            (elo) => elo.tipoEvento === 'APROVACAO',
          );
          expect(aprovacoes).toHaveLength(1);
        }
      },
      120_000,
    );

    it('CT-07: versão desatualizada → 409 e o estado não muda (CA-05.3)', async () => {
      const criada = await criarSolicitacao(500);
      const desatualizada = await decidir(criada.id, 'aprovar', TOKENS.coordenadorN1, {
        versao: criada.versao + 1,
      });
      expect(desatualizada.status).toBe(409);

      // Se o estado não mudou, a versão correta ainda é aceita.
      const correta = await decidir(criada.id, 'aprovar', TOKENS.coordenadorN1, { versao: criada.versao });
      expect(correta.status).toBe(200);
    });
  });

  describe('CT-08 — Teto da faixa de alçada (CA-01.1)', () => {
    const adminDoTenant = (tenantId: string) =>
      criarToken({ uid: `admin-${tenantId}`, tenantId, role: 'ADMIN' });

    it.each([
      ['-1', 400, -1],
      ['0', 400, 0],
      ['vazio', 400, ''],
      ['0.01', 200, 0.01],
      ['1000.123', 400, 1000.123],
    ])('CT-08: teto do N1 = %s → %s', async (_rotulo, esperado, teto) => {
      const res = await axios.put(
        '/api/alcadas/tetos',
        { tiers: [{ level: 'N1', maxAmount: teto }] },
        comToken(adminDoTenant('ep-bva-tetos')),
      );
      expect(res.status).toBe(esperado);
    });

    it('CT-08: lote com uma faixa inválida → 400 e nenhuma faixa é gravada', async () => {
      const admin = adminDoTenant('ep-bva-atomico');
      const inicial = await axios.put('/api/alcadas/tetos', { tiers: [{ level: 'N1', maxAmount: 800 }] }, comToken(admin));
      expect(inicial.status).toBe(200);

      const lote = await axios.put(
        '/api/alcadas/tetos',
        { tiers: [{ level: 'N1', maxAmount: 900 }, { level: 'N2', maxAmount: 0 }] },
        comToken(admin),
      );
      expect(lote.status).toBe(400);

      const atual = await axios.get('/api/alcadas/tetos', comToken(admin));
      const n1 = (atual.data as Array<{ level: string; maxAmount: number }>).find((t) => t.level === 'N1');
      expect(n1?.maxAmount).toBe(800);
    });
  });
});
