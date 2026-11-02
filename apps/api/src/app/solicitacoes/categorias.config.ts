import { CATEGORIAS_SOLICITACAO } from '@alcadas-core/models';

/**
 * Limites base por categoria, derivados do catálogo compartilhado com o frontend
 * (`libs/shared/models/src/lib/categorias.ts`). Fica como mapa para consulta direta no validador.
 */
export const CATEGORIAS_CONFIG: Record<string, { limiteBase: number }> = Object.fromEntries(
  CATEGORIAS_SOLICITACAO.map((categoria) => [categoria.id, { limiteBase: categoria.limiteBase }]),
);
