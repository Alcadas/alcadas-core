import {
  CATEGORIAS_SOLICITACAO,
  JUSTIFICATIVA_MINIMA_ACIMA_DA_BASE,
  buscarCategoria,
  justificativaSuficiente,
} from './categorias';

describe('categorias de solicitação (RN02)', () => {
  const trintaCaracteres = 'x'.repeat(JUSTIFICATIVA_MINIMA_ACIMA_DA_BASE);

  it('expõe um catálogo único com ids sem repetição', () => {
    const ids = CATEGORIAS_SOLICITACAO.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('busca a categoria pelo id', () => {
    expect(buscarCategoria('EQUIPAMENTOS')?.limiteBase).toBe(5000);
    expect(buscarCategoria('INEXISTENTE')).toBeUndefined();
  });

  it('CA-02.2: valor até a base não exige justificativa longa', () => {
    expect(justificativaSuficiente('SERVICOS_TERCEIROS', 1000, '')).toBe(true);
  });

  it('CA-02.2: acima da base exige 30 caracteres (29 recusa, 30 aceita)', () => {
    expect(justificativaSuficiente('SERVICOS_TERCEIROS', 1000.01, trintaCaracteres.slice(1))).toBe(false);
    expect(justificativaSuficiente('SERVICOS_TERCEIROS', 1000.01, trintaCaracteres)).toBe(true);
  });
});
