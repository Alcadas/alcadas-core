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
});