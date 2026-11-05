export const SOLICITACOES_REPOSITORY = 'SOLICITACOES_REPOSITORY';

export interface FiltroListagem {
  status?: string;
  page: number;
  limit: number;
}

export interface ISolicitacoesRepository {
  salvarComTrilha(solicitacao: Record<string, unknown>, eloTrilha: Record<string, unknown>): Promise<void>;
  listarPorTenant(tenantId: string, filtro: FiltroListagem): Promise<Record<string, unknown>[]>;
}
