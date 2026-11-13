import {
  FaixaRegraAlcada,
  MODELOS_REGRAS_ALCADA,
  buscarModeloRegra,
  proximaFaixaRegra,
  validarFaixasRegra,
} from './modelos-regras';

describe('modelos pré-definidos de regras de alçada (#69)', () => {
  it('disponibiliza pelo menos 4 modelos com ids únicos', () => {
    expect(MODELOS_REGRAS_ALCADA.length).toBeGreaterThanOrEqual(4);
    const ids = MODELOS_REGRAS_ALCADA.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('inclui os modelos de mercado pedidos na issue', () => {
    expect(buscarModeloRegra('reembolso-despesas-operacionais')).toBeDefined();
    expect(buscarModeloRegra('aquisicao-equipamentos-ti')).toBeDefined();
    expect(buscarModeloRegra('fornecedores-servicos-recorrentes')).toBeDefined();
    expect(buscarModeloRegra('viagens-hospedagem')).toBeDefined();
  });

  it('reembolso: Coordenação até R$ 500 e Gerência até R$ 2.000', () => {
    const faixas = buscarModeloRegra('reembolso-despesas-operacionais')?.faixas ?? [];
    expect(faixas[0]).toMatchObject({ valorMaximo: 500, papelAprovador: 'COORDENADOR' });
    expect(faixas[1]).toMatchObject({ valorMaximo: 2000, papelAprovador: 'GERENTE' });
  });

  it.each(MODELOS_REGRAS_ALCADA.map((m) => [m.id, m]))(
    'o modelo %s já nasce com faixas válidas',
    (_id, modelo) => {
      expect(validarFaixasRegra(modelo.faixas)).toEqual([]);
    },
  );
});

describe('validarFaixasRegra', () => {
  const faixa = (parcial: Partial<FaixaRegraAlcada>): FaixaRegraAlcada => ({
    id: 'x',
    valorMinimo: 0,
    valorMaximo: 100,
    papelAprovador: 'GERENTE',
    ...parcial,
  });

  it('exige ao menos uma faixa', () => {
    expect(validarFaixasRegra([])).toEqual([
      expect.objectContaining({ indice: null, campo: 'faixas' }),
    ]);
  });

  it('recusa máximo menor ou igual ao mínimo', () => {
    const erros = validarFaixasRegra([faixa({ valorMinimo: 500, valorMaximo: 500 })]);
    expect(erros).toEqual([expect.objectContaining({ indice: 0, campo: 'valorMaximo' })]);
  });

  it('recusa mínimo vazio ou negativo', () => {
    expect(validarFaixasRegra([faixa({ valorMinimo: null })])[0].campo).toBe('valorMinimo');
    expect(validarFaixasRegra([faixa({ valorMinimo: -1 })])[0].campo).toBe('valorMinimo');
  });

  it('só permite "sem limite" na última faixa', () => {
    const erros = validarFaixasRegra([
      faixa({ valorMaximo: null }),
      faixa({ valorMinimo: 100.01, valorMaximo: null }),
    ]);
    expect(erros).toEqual([expect.objectContaining({ indice: 0, campo: 'valorMaximo' })]);
  });

  it('recusa faixas sobrepostas', () => {
    const erros = validarFaixasRegra([
      faixa({ valorMinimo: 0, valorMaximo: 1000 }),
      faixa({ valorMinimo: 900, valorMaximo: 2000 }),
    ]);
    expect(erros).toEqual([expect.objectContaining({ indice: 1, campo: 'valorMinimo' })]);
  });

  it('exige papel aprovador conhecido', () => {
    expect(validarFaixasRegra([faixa({ papelAprovador: '' })])[0].campo).toBe('papelAprovador');
  });

  it('proximaFaixaRegra começa logo após o máximo da última faixa', () => {
    const nova = proximaFaixaRegra([faixa({ valorMaximo: 2000 })], 'f2');
    expect(nova).toEqual({ id: 'f2', valorMinimo: 2000.01, valorMaximo: null, papelAprovador: '' });
  });
});
