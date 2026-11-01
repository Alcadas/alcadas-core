/**
 * Catálogo único de categorias de despesa (RF02 / RN02), compartilhado entre API e frontend.
 * `limiteBase` é o valor acima do qual a justificativa passa a exigir no mínimo
 * `JUSTIFICATIVA_MINIMA_ACIMA_DA_BASE` caracteres (CA-02.2).
 */
export interface CategoriaSolicitacao {
  id: string;
  label: string;
  limiteBase: number;
}

export const CATEGORIAS_SOLICITACAO: readonly CategoriaSolicitacao[] = Object.freeze([
  { id: 'SERVICOS_TERCEIROS', label: 'Serviços de Terceiros', limiteBase: 1000 },
  { id: 'EQUIPAMENTOS', label: 'Equipamentos', limiteBase: 5000 },
  { id: 'MATERIAL_ESCRITORIO', label: 'Material de Escritório', limiteBase: 500 },
]);

export const JUSTIFICATIVA_MINIMA_ACIMA_DA_BASE = 30;

export function buscarCategoria(id: string): CategoriaSolicitacao | undefined {
  return CATEGORIAS_SOLICITACAO.find((categoria) => categoria.id === id);
}

/** Indica se a justificativa informada atende à RN02 para o valor e a categoria. */
export function justificativaSuficiente(
  categoriaId: string,
  valor: number,
  justificativa: string | undefined,
): boolean {
  const categoria = buscarCategoria(categoriaId);
  if (!categoria || valor <= categoria.limiteBase) {
    return true;
  }
  return (justificativa ?? '').trim().length >= JUSTIFICATIVA_MINIMA_ACIMA_DA_BASE;
}
