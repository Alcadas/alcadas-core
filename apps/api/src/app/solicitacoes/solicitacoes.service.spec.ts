import { Test, TestingModule } from '@nestjs/testing';
import { SolicitacoesService } from './solicitacoes.service';
import { SolicitacaoValidator } from './solicitacao.validator';
import { SOLICITACOES_REPOSITORY } from './solicitacoes.repository';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';

describe('SolicitacoesService', () => {
  let service: SolicitacoesService;
  let validadorMock: Record<string, jest.Mock>;
  let repositoryMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    validadorMock = { validarCriacao: jest.fn() };
    repositoryMock = { 
      salvarComTrilha: jest.fn().mockResolvedValue(undefined),
      listarPorTenant: jest.fn().mockResolvedValue([])
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitacoesService,
        { provide: SolicitacaoValidator, useValue: validadorMock },
        { provide: SOLICITACOES_REPOSITORY, useValue: repositoryMock },
      ],
    }).compile();

    service = module.get<SolicitacoesService>(SolicitacoesService);
  });

  it('deve criar uma solicitação com status PENDENTE e gerar elo da trilha', async () => {
    const dto = {
      centroCustoId: 'CC-01',
      valor: 500,
      categoria: 'SERVICOS_TERCEIROS',
    } as CriarSolicitacaoDto;

    const result = await service.criarSolicitacao(dto, 'tenant-123', 'user-456');

    expect(validadorMock.validarCriacao).toHaveBeenCalledWith(dto);
    expect(result.status).toBe('PENDENTE');
    expect(result.versao).toBe(1);
    expect(result.tenantId).toBe('tenant-123');
    
    expect(repositoryMock.salvarComTrilha).toHaveBeenCalledTimes(1);
  });

  it('US-07: grava o elo de criação no formato da trilha (sequência 1, CRIACAO_SOLICITACAO)', async () => {
    const dto = { centroCustoId: 'CC-01', valor: 500, categoria: 'SERVICOS_TERCEIROS' } as CriarSolicitacaoDto;

    await service.criarSolicitacao(dto, 'tenant-123', 'user-456');

    const [, elo] = repositoryMock.salvarComTrilha.mock.calls[0];
    expect(elo).toMatchObject({ sequencia: 1, tipoEvento: 'CRIACAO_SOLICITACAO', authorId: 'user-456' });
  });

  it('repassa a paginação e o filtro de status ao repositório', async () => {
    await service.listarPorTenant('tenant-123', { page: 2, limit: 20, status: 'PENDENTE' });

    expect(repositoryMock.listarPorTenant).toHaveBeenCalledWith('tenant-123', { page: 2, limit: 20, status: 'PENDENTE' });
  });

  describe('Associação automática de fluxos de aprovação (Issue #66)', () => {
    it('associa solicitação de até R$ 1.000 ao fluxo N1 de 1 etapa', async () => {
      const dto = {
        centroCustoId: 'CC-01',
        valor: 800,
        categoria: 'MATERIAL_ESCRITORIO',
      } as CriarSolicitacaoDto;

      const result = await service.criarSolicitacao(dto, 'tenant-123', 'user-456');

      expect(result.fluxoId).toBe('tier-n1');
      expect(result.totalEtapas).toBe(1);
      expect(result.etapaAtual).toBe(1);
      expect(result.aprovadorEsperadoPapel).toBe('APROVADOR_N1');
    });

    it('associa solicitação de R$ 2.500 ao fluxo N2 de 2 etapas com início em N1', async () => {
      const dto = {
        centroCustoId: 'CC-01',
        valor: 2500,
        categoria: 'SERVICOS_TERCEIROS',
      } as CriarSolicitacaoDto;

      const result = await service.criarSolicitacao(dto, 'tenant-123', 'user-456');

      expect(result.fluxoId).toBe('tier-n2');
      expect(result.totalEtapas).toBe(2);
      expect(result.etapaAtual).toBe(1);
      expect(result.aprovadorEsperadoPapel).toBe('APROVADOR_N1');
    });

    it('associa solicitação de R$ 15.000 ao fluxo N3 de 3 etapas com início em N1', async () => {
      const dto = {
        centroCustoId: 'CC-01',
        valor: 15000,
        categoria: 'EQUIPAMENTOS',
      } as CriarSolicitacaoDto;

      const result = await service.criarSolicitacao(dto, 'tenant-123', 'user-456');

      expect(result.fluxoId).toBe('tier-n3');
      expect(result.totalEtapas).toBe(3);
      expect(result.etapaAtual).toBe(1);
      expect(result.aprovadorEsperadoPapel).toBe('APROVADOR_N1');
    });

    it('impede solicitante do RH de criar solicitação para centro de custo de outra área (HTTP 403)', async () => {
      const dto = {
        centroCustoId: 'CC-FIN-01',
        valor: 1500,
        categoria: 'EQUIPAMENTOS',
      } as CriarSolicitacaoDto;

      const usuarioRH = {
        uid: 'user-rh',
        tenantId: 'tenant-123',
        papeis: ['SOLICITANTE'],
        costCenterId: 'CC-RH-103',
        departmentId: 'dep-rh',
      };

      await expect(
        service.criarSolicitacao(dto, 'tenant-123', 'user-rh', usuarioRH),
      ).rejects.toThrow('O solicitante só pode submeter solicitações para o centro de custo do seu próprio departamento.');
    });

    it('permite solicitante do RH criar solicitação para o centro de custo do próprio departamento', async () => {
      const dto = {
        centroCustoId: 'CC-RH-103',
        valor: 1500,
        categoria: 'EQUIPAMENTOS',
      } as CriarSolicitacaoDto;

      const usuarioRH = {
        uid: 'user-rh',
        tenantId: 'tenant-123',
        papeis: ['SOLICITANTE'],
        costCenterId: 'CC-RH-103',
        departmentId: 'dep-rh',
      };

      const result = await service.criarSolicitacao(dto, 'tenant-123', 'user-rh', usuarioRH);
      expect(result.centroCustoId).toBe('CC-RH-103');
    });

    it('permite administrador global criar solicitação para qualquer centro de custo', async () => {
      const dto = {
        centroCustoId: 'CC-FIN-01',
        valor: 1500,
        categoria: 'EQUIPAMENTOS',
      } as CriarSolicitacaoDto;

      const usuarioAdmin = {
        uid: 'user-admin',
        tenantId: 'tenant-123',
        papeis: ['ADMIN'],
        costCenterId: 'CC-RH-103',
        departmentId: 'dep-rh',
      };

      const result = await service.criarSolicitacao(dto, 'tenant-123', 'user-admin', usuarioAdmin);
      expect(result.centroCustoId).toBe('CC-FIN-01');
    });
  });
});