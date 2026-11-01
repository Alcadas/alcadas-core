import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { SolicitacaoValidator } from './solicitacao.validator';
import { TrilhaAuditoria } from './trilha';
import { ISolicitacoesRepository, SOLICITACOES_REPOSITORY } from './solicitacoes.repository';

export interface ParametrosListagem {
  status?: string;
  page: number;
  limit: number;
}

@Injectable()
export class SolicitacoesService {
  constructor(
    private readonly validador: SolicitacaoValidator,
    @Inject(SOLICITACOES_REPOSITORY) private readonly repository: ISolicitacoesRepository
  ) {}

  async criarSolicitacao(dto: CriarSolicitacaoDto, tenantId: string, solicitanteId: string) {
    this.validador.validarCriacao(dto);

    const solicitacaoId = `sol-${uuidv4().substring(0, 8)}`;
    const agora = new Date().toISOString();

    const solicitacao = {
      id: solicitacaoId,
      tenantId,
      centroCustoId: dto.centroCustoId,
      solicitanteId,
      valor: dto.valor,
      categoria: dto.categoria,
      justificativa: dto.justificativa || '',
      fornecedor: dto.fornecedor || null,
      status: 'PENDENTE',
      versao: 1,
      createdAt: agora,
      updatedAt: agora,
    };

    const eloTrilha = TrilhaAuditoria.gerarEloGenese({
      centroCustoId: dto.centroCustoId,
      valor: dto.valor,
      categoria: dto.categoria
    }, solicitanteId, agora);

    await this.repository.salvarComTrilha(solicitacao, eloTrilha);

    return solicitacao;
  }

  async listarPorTenant(tenantId: string, parametros?: ParametrosListagem) {
    if (parametros) {
      console.debug(`Filtros aplicados: page ${parametros.page}, limit ${parametros.limit}`);
    }
    return this.repository.listarPorTenant(tenantId);
  }
}
