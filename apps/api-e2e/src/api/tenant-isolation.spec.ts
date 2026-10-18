import axios from 'axios';

const TOKEN_USUARIO_A = 'token-do-usuario-da-empresa-A';
const ID_SOLICITACAO_EMPRESA_B = 'id-de-uma-solicitacao-da-empresa-B';

describe('Isolamento de tenant', () => {
  it.skip('usuario da empresa A recebe 403 ou 404 ao acessar solicitacao da empresa B', () => {
    return axios
      .get(`/api/solicitacoes/${ID_SOLICITACAO_EMPRESA_B}`, {
        headers: { Authorization: `Bearer ${TOKEN_USUARIO_A}` },
        validateStatus: () => true,
      })
      .then((res) => {
        expect([403, 404]).toContain(res.status);
      });
  });

  it.skip('listagem da empresa A nao traz solicitacoes da empresa B', () => {
    return axios
      .get('/api/solicitacoes', {
        headers: { Authorization: `Bearer ${TOKEN_USUARIO_A}` },
        validateStatus: () => true,
      })
      .then((res) => {
        expect(res.status).toBe(200);
        const ids = res.data.map((solicitacao: { id: string }) => solicitacao.id);
        expect(ids).not.toContain(ID_SOLICITACAO_EMPRESA_B);
      });
  });
});
