import { SolicitacaoValidator } from './solicitacao.validator';
import { BadRequestException } from '@nestjs/common';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { CATEGORIAS_CONFIG } from './categorias.config';

describe('SolicitacaoValidator', () => {
  let validator: SolicitacaoValidator;

  beforeEach(() => {
    validator = new SolicitacaoValidator();
    CATEGORIAS_CONFIG['TESTE'] = { limiteBase: 1000.0 };
  });

  const dtoValido = {
    centroCustoId: 'CC-01',
    categoria: 'TESTE',
    valor: 500,
    justificativa: 'Justificativa de teste',
  } as CriarSolicitacaoDto;

  it('deve passar quando todos os campos obrigatórios estiverem presentes e válidos', () => {
    expect(() => validator.validarCriacao(dtoValido)).not.toThrow();
  });

  describe('Campos Obrigatórios (CA-02.1 / BUG-003)', () => {
    it('deve lançar BadRequestException quando centroCustoId for ausente', () => {
      const dto = { ...dtoValido, centroCustoId: '' } as CriarSolicitacaoDto;
      expect(() => validator.validarCriacao(dto)).toThrow('centroCustoId');
    });

    it('deve lançar BadRequestException quando valor for ausente', () => {
      const dto = { ...dtoValido, valor: undefined as unknown as number } as CriarSolicitacaoDto;
      expect(() => validator.validarCriacao(dto)).toThrow('valor');
    });

    it('deve lançar BadRequestException quando categoria for ausente', () => {
      const dto = { ...dtoValido, categoria: '' } as CriarSolicitacaoDto;
      expect(() => validator.validarCriacao(dto)).toThrow('categoria');
    });

    it('deve lançar BadRequestException quando justificativa for ausente', () => {
      const dto = { ...dtoValido, justificativa: '' } as CriarSolicitacaoDto;
      expect(() => validator.validarCriacao(dto)).toThrow('justificativa');
    });
  });

  describe('Validação de Valor (CA-02.3 / BUG-001)', () => {
    it('deve lançar BadRequestException para valor zero', () => {
      const dto = { ...dtoValido, valor: 0 };
      expect(() => validator.validarCriacao(dto)).toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException para valor negativo', () => {
      const dto = { ...dtoValido, valor: -1 };
      expect(() => validator.validarCriacao(dto)).toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException para valor com mais de 2 casas decimais', () => {
      const dto = { ...dtoValido, valor: 10.123 };
      expect(() => validator.validarCriacao(dto)).toThrow(BadRequestException);
    });

    it('deve aceitar valor com exatamente 2 casas decimais', () => {
      const dto = { ...dtoValido, valor: 0.01 };
      expect(() => validator.validarCriacao(dto)).not.toThrow();
    });
  });

  describe('Justificativa Acima da Base (CA-02.2)', () => {
    it('deve lançar BadRequestException se o valor exceder a base e a justificativa for curta', () => {
      const dto = {
        ...dtoValido,
        valor: 1500,
        justificativa: '12345678901234567890123456789',
      } as CriarSolicitacaoDto;

      expect(() => validator.validarCriacao(dto)).toThrow(BadRequestException);
    });

    it('deve passar se o valor exceder a base e a justificativa tiver 30 ou mais caracteres', () => {
      const dto = {
        ...dtoValido,
        valor: 1500,
        justificativa: 'Esta justificativa possui exatamente ou mais de 30 caracteres.',
      } as CriarSolicitacaoDto;

      expect(() => validator.validarCriacao(dto)).not.toThrow();
    });
  });
});