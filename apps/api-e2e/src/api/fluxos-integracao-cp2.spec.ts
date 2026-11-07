import axios from 'axios';

function criarTokenTeste(payload: {
  uid: string;
  tenantId: string;
  role: string;
  level?: string;
  maxApprovalLimit?: number | null;
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
  uid: 'usr-solicitante-cp2',
  tenantId: 'startop',
  role: 'SOLICITANTE',
});

const TOKEN_COORDENADOR_N1 = criarTokenTeste({
  uid: 'usr-coord-cp2',
  tenantId: 'startop',
  role: 'APROVADOR_N1',
  level: 'N1',
  maxApprovalLimit: 1000,
});

const TOKEN_GERENTE_N2 = criarTokenTeste({
  uid: 'usr-gerente-cp2',
  tenantId: 'startop',
  role: 'APROVADOR_N2',
  level: 'N2',
  maxApprovalLimit: 5000,
});

describe('Integração Ponta a Ponta: Fluxos ↔ Solicitações ↔ Aprovações (Issue #66 - DEB-CP2)', () => {
  let solicitacaoMultinivelId: string;
  let solicitacaoAjusteId: string;

  it('1. Fluxos -> Solicitações: cria solicitação e vincula automaticamente ao fluxo compatível (tier-n2, 2 etapas)', async () => {
    const res = await axios.post(
      '/api/solicitacoes',
      {
        centroCustoId: 'cc-clinica-centro',
        valor: 2500,
        categoria: 'SERVICOS_TERCEIROS',
        justificativa: 'Contratação de assessoria especializada de integração contínua',
      },
      {
        headers: { Authorization: `Bearer ${TOKEN_SOLICITANTE}` },
      },
    );

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      status: 'PENDENTE',
      versao: 1,
      valor: 2500,
      fluxoId: 'tier-n2',
      fluxoNome: 'Alçada N2 — Gerência',
      totalEtapas: 2,
      etapaAtual: 1,
      aprovadorEsperadoPapel: 'APROVADOR_N1',
      aprovadorEsperadoNivel: 'N1',
    });

    solicitacaoMultinivelId = res.data.id;
  });

  it('2. Solicitações -> Aprovações: N2 é bloqueado ao tentar aprovar antes da deliberação da Etapa 1 (N1)', async () => {
    const res = await axios.post(
      `/api/solicitacoes/${solicitacaoMultinivelId}/aprovar`,
      { versao: 1, observacao: 'Tentativa prematura de N2' },
      {
        headers: { Authorization: `Bearer ${TOKEN_GERENTE_N2}` },
        validateStatus: () => true,
      },
    );

    expect(res.status).toBe(403);
    expect(res.data.message).toContain('Apenas o aprovador da etapa corrente');
  });

  it('3. Aprovações -> Fluxos (Avanço de Etapa): N1 aprova e a solicitação avança para a Etapa 2 (permanece PENDENTE)', async () => {
    const res = await axios.post(
      `/api/solicitacoes/${solicitacaoMultinivelId}/aprovar`,
      { versao: 1, observacao: 'Triagem operacional N1 aprovada com sucesso' },
      {
        headers: { Authorization: `Bearer ${TOKEN_COORDENADOR_N1}` },
      },
    );

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      status: 'PENDENTE',
      versao: 2,
      etapaAtual: 2,
      totalEtapas: 2,
      aprovadorEsperadoPapel: 'APROVADOR_N2',
      aprovadorEsperadoNivel: 'N2',
    });

    // Confere se o evento de avanço de etapa foi registrado na trilha SHA-256
    const trilhaRes = await axios.get(`/api/solicitacoes/${solicitacaoMultinivelId}/trilha`, {
      headers: { Authorization: `Bearer ${TOKEN_GERENTE_N2}` },
    });

    expect(trilhaRes.status).toBe(200);
    const elos = trilhaRes.data;
    expect(elos.length).toBeGreaterThanOrEqual(2);
    expect(elos[elos.length - 1]).toMatchObject({
      tipoEvento: 'APROVACAO',
      authorId: 'usr-coord-cp2',
    });
    expect(elos[elos.length - 1].payload).toMatchObject({
      etapaAprovada: 1,
      proximaEtapa: 2,
      avancoFluxo: true,
    });
  });

  it('4. Aprovação Final: N2 aprova a Etapa 2 e a solicitação atinge o status APROVADA com trilha íntegra', async () => {
    const res = await axios.post(
      `/api/solicitacoes/${solicitacaoMultinivelId}/aprovar`,
      { versao: 2, observacao: 'Aprovação financeira final N2 homologada' },
      {
        headers: { Authorization: `Bearer ${TOKEN_GERENTE_N2}` },
      },
    );

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      status: 'APROVADA',
      versao: 3,
      etapaAtual: 2,
      totalEtapas: 2,
    });

    // Verificação criptográfica determinística da cadeia SHA-256
    const verifRes = await axios.post(
      `/api/solicitacoes/${solicitacaoMultinivelId}/trilha/verificar`,
      {},
      {
        headers: { Authorization: `Bearer ${TOKEN_GERENTE_N2}` },
      },
    );

    expect(verifRes.status).toBe(200);
    expect(verifRes.data).toMatchObject({
      status: 'INTEGRA',
      eloInconsistente: null,
    });
  });

  it('5. Ciclo de Ajuste / Rejeição: pedido de ajuste move para EM_AJUSTE e reenvio reseta a esteira para Etapa 1', async () => {
    // 5.1 Solicitante cria pedido
    const criaRes = await axios.post(
      '/api/solicitacoes',
      {
        centroCustoId: 'cc-clinica-centro',
        valor: 850,
        categoria: 'MATERIAL_ESCRITORIO',
        justificativa: 'Compra emergencial de papelaria e suprimentos administrativos',
      },
      {
        headers: { Authorization: `Bearer ${TOKEN_SOLICITANTE}` },
      },
    );
    expect(criaRes.status).toBe(201);
    solicitacaoAjusteId = criaRes.data.id;

    // 5.2 Aprovador pede ajuste
    const ajusteRes = await axios.post(
      `/api/solicitacoes/${solicitacaoAjusteId}/ajuste`,
      { versao: 1, motivo: 'Favor anexar ao menos 2 orçamentos comparativos' },
      {
        headers: { Authorization: `Bearer ${TOKEN_COORDENADOR_N1}` },
      },
    );
    expect(ajusteRes.status).toBe(200);
    expect(ajusteRes.data.status).toBe('EM_AJUSTE');

    // 5.3 Solicitante corrige e reenvia
    const reenvioRes = await axios.put(
      `/api/solicitacoes/${solicitacaoAjusteId}`,
      {
        justificativa: 'Compra com 3 orçamentos comparativos devidamente anexados',
      },
      {
        headers: { Authorization: `Bearer ${TOKEN_SOLICITANTE}` },
      },
    );
    expect(reenvioRes.status).toBe(200);
    expect(reenvioRes.data).toMatchObject({
      status: 'PENDENTE',
      etapaAtual: 1,
      aprovadorEsperadoPapel: 'APROVADOR_N1',
    });

    // 5.4 Aprovador aprova solicitação corrigida
    const aprovaRes = await axios.post(
      `/api/solicitacoes/${solicitacaoAjusteId}/aprovar`,
      { versao: reenvioRes.data.versao },
      {
        headers: { Authorization: `Bearer ${TOKEN_COORDENADOR_N1}` },
      },
    );
    expect(aprovaRes.status).toBe(200);
    expect(aprovaRes.data.status).toBe('APROVADA');
  });
});
