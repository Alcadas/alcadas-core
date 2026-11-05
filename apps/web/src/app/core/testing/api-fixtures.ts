import { ApprovalTier, EloAuditoriaDto, SolicitacaoResponseDto } from '@alcadas-core/models';

/** Dados no formato da API (OpenAPI v0.2), usados pelas specs. */
export function solicitacaoDaApi(parcial: Partial<SolicitacaoResponseDto> = {}): SolicitacaoResponseDto {
  return {
    id: 'sol-001',
    tenantId: 'startop',
    centroCustoId: 'cc-clinica-centro',
    solicitanteId: 'ana',
    valor: 3200,
    categoria: 'SERVICOS_TERCEIROS',
    justificativa: 'Manutenção do aparelho de raio-x da unidade Centro',
    status: 'PENDENTE',
    versao: 1,
    createdAt: '2026-10-27T10:02:00.000Z',
    updatedAt: '2026-10-27T10:02:00.000Z',
    ...parcial,
  };
}

export function tetoDaApi(nivel: 'N1' | 'N2' | 'N3', teto: number | null): ApprovalTier {
  return {
    id: `tier-${nivel}`,
    tenantId: 'startop',
    costCenterId: null,
    level: nivel,
    approverRole: nivel === 'N1' ? 'APROVADOR_N1' : nivel === 'N2' ? 'APROVADOR_N2' : 'DIRETOR_CFO',
    roleTitle: nivel === 'N2' ? 'Gerente' : '',
    minAmount: 0,
    maxAmount: teto,
    unlimited: teto === null,
    requiredApprovals: 1,
    updatedAt: '2026-10-20T00:00:00.000Z',
  };
}

export function eloDaApi(parcial: Partial<EloAuditoriaDto>): EloAuditoriaDto {
  return {
    sequencia: 1,
    hashAtual: 'a'.repeat(64),
    hashAnterior: '0'.repeat(64),
    tipoEvento: 'CRIACAO_SOLICITACAO',
    authorId: 'ana',
    timestampUtc: '2026-10-27T10:02:00.000Z',
    payload: {},
    ...parcial,
  };
}
