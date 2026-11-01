export const SOLICITACOES_REPOSITORY = 'SOLICITACOES_REPOSITORY';

export interface ISolicitacoesRepository {
  salvarComTrilha(solicitacao: Record<string, unknown>, eloTrilha: Record<string, unknown>): Promise<void>;
  listarPorTenant(tenantId: string): Promise<Record<string, unknown>[]>;
}