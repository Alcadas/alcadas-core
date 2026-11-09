import { Injectable, Inject, Optional, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { SolicitacaoValidator } from './solicitacao.validator';
import { TrilhaAuditoria } from './trilha';
import { FiltroListagem, ISolicitacoesRepository, SOLICITACOES_REPOSITORY } from './solicitacoes.repository';
import { FirestoreService } from '../database/firestore.service';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';

@Injectable()
export class SolicitacoesService {
  constructor(
    private readonly validador: SolicitacaoValidator,
    @Inject(SOLICITACOES_REPOSITORY) private readonly repository: ISolicitacoesRepository,
    @Optional() private readonly firestore?: FirestoreService,
  ) {}

  async avaliarFluxoCompativel(tenantId: string, dto: CriarSolicitacaoDto): Promise<{
    fluxoId: string;
    fluxoNome: string;
    totalEtapas: number;
    etapaAtual: number;
    aprovadorEsperadoPapel: string;
    aprovadorEsperadoNivel: 'N1' | 'N2' | 'N3';
  }> {
    // 1. Se o dto já trouxe fluxoId explícito do catálogo do frontend
    if (dto.fluxoId && dto.fluxoNome) {
      const totalEtapas = dto.valor > 5000 ? 3 : dto.valor > 1000 ? 2 : 1;
      return {
        fluxoId: dto.fluxoId,
        fluxoNome: dto.fluxoNome,
        totalEtapas,
        etapaAtual: 1,
        aprovadorEsperadoPapel: 'APROVADOR_N1',
        aprovadorEsperadoNivel: 'N1',
      };
    }

    // 2. Busca fluxos ativos customizados salvos no Firestore do tenant
    if (this.firestore) {
      try {
        const workflows = await this.firestore.listTenantCollection<Record<string, unknown>>(
          tenantId,
          'workflows',
        );
        const ativo = workflows.find((w) => {
          if (w['status'] !== 'ACTIVE') return false;
          const ceiling = typeof w['ceilingAmount'] === 'number' ? w['ceilingAmount'] : Infinity;
          if (dto.valor > ceiling) return false;
          const config = (w['config'] as Record<string, unknown>) ?? {};
          if (config['costCenter'] && config['costCenter'] === dto.centroCustoId) return true;
          if (config['category'] && config['category'] === dto.categoria) return true;
          return true;
        });

        if (ativo) {
          const totalEtapas = Array.isArray(ativo['steps']) && ativo['steps'].length > 1
            ? ativo['steps'].length
            : dto.valor > 5000 ? 3 : dto.valor > 1000 ? 2 : 1;
          return {
            fluxoId: String(ativo['id'] ?? 'wf-custom'),
            fluxoNome: String(ativo['title'] ?? 'Fluxo Customizado de Alçada'),
            totalEtapas,
            etapaAtual: 1,
            aprovadorEsperadoPapel: 'APROVADOR_N1',
            aprovadorEsperadoNivel: 'N1',
          };
        }
      } catch {
        // Fallback para a esteira padrão de alçadas
      }
    }

    // 3. Esteira padrão do sistema por faixas de alçada (N1: <= 1.000, N2: <= 5.000, N3: > 5.000)
    if (dto.valor <= 1000) {
      return {
        fluxoId: 'tier-n1',
        fluxoNome: 'Alçada N1 — Coordenação',
        totalEtapas: 1,
        etapaAtual: 1,
        aprovadorEsperadoPapel: 'APROVADOR_N1',
        aprovadorEsperadoNivel: 'N1',
      };
    }

    if (dto.valor <= 5000) {
      return {
        fluxoId: 'tier-n2',
        fluxoNome: 'Alçada N2 — Gerência',
        totalEtapas: 2,
        etapaAtual: 1,
        aprovadorEsperadoPapel: 'APROVADOR_N1',
        aprovadorEsperadoNivel: 'N1',
      };
    }

    return {
      fluxoId: 'tier-n3',
      fluxoNome: 'Alçada N3 — Diretoria Executiva / CFO',
      totalEtapas: 3,
      etapaAtual: 1,
      aprovadorEsperadoPapel: 'APROVADOR_N1',
      aprovadorEsperadoNivel: 'N1',
    };
  }

  async criarSolicitacao(
    dto: CriarSolicitacaoDto,
    tenantId: string,
    solicitanteId: string,
    usuario?: UsuarioAutenticado,
  ) {
    this.validador.validarCriacao(dto);

    if (usuario && (usuario.costCenterId || usuario.departmentId)) {
      const globalRoles = ['DIRETOR_CFO', 'ADMIN', 'SUPER_USER'];
      const ehGlobal = (usuario.papeis || []).some((p) => globalRoles.includes(p));
      if (!ehGlobal) {
        const centroEsperado = (usuario.costCenterId || '').toLowerCase().trim();
        const deptoEsperado = (usuario.departmentId || '').toLowerCase().trim();
        const centroInformado = (dto.centroCustoId || '').toLowerCase().trim();

        const ccValido =
          (centroEsperado && centroInformado === centroEsperado) ||
          (deptoEsperado && centroInformado === deptoEsperado);

        if (!ccValido) {
          throw new ForbiddenException(
            'O solicitante só pode submeter solicitações para o centro de custo do seu próprio departamento.',
          );
        }
      }
    }

    const fluxo = await this.avaliarFluxoCompativel(tenantId, dto);
    const solicitacaoId = `sol-${uuidv4().substring(0, 8)}`;
    const agora = new Date().toISOString();

    const solicitacao = {
      id: solicitacaoId,
      tenantId,
      centroCustoId: dto.centroCustoId,
      solicitanteId,
      solicitanteNome: dto.solicitanteNome || null,
      solicitanteCargo: dto.solicitanteCargo || null,
      valor: dto.valor,
      categoria: dto.categoria,
      justificativa: dto.justificativa || '',
      fornecedor: dto.fornecedor || null,
      status: 'PENDENTE',
      versao: 1,
      fluxoId: fluxo.fluxoId,
      fluxoNome: fluxo.fluxoNome,
      totalEtapas: fluxo.totalEtapas,
      etapaAtual: fluxo.etapaAtual,
      aprovadorEsperadoPapel: fluxo.aprovadorEsperadoPapel,
      aprovadorEsperadoNivel: fluxo.aprovadorEsperadoNivel,
      createdAt: agora,
      updatedAt: agora,
    };

    const eloTrilha = TrilhaAuditoria.gerarEloGenese({
      centroCustoId: dto.centroCustoId,
      valor: dto.valor,
      categoria: dto.categoria,
      fluxoId: fluxo.fluxoId,
      totalEtapas: fluxo.totalEtapas,
    }, solicitanteId, agora);

    await this.repository.salvarComTrilha(solicitacao, eloTrilha);

    return solicitacao;
  }

  async listarPorTenant(tenantId: string, filtro: FiltroListagem) {
    return this.repository.listarPorTenant(tenantId, filtro);
  }
}
