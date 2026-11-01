import { SolicitacaoValidator } from './solicitacao.validator';
import { BadRequestException } from '@nestjs/common';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { CATEGORIAS_CONFIG } from './categorias.config';

describe('SolicitacaoValidator', () => {
  let validator: SolicitacaoValidator;

  beforeEach(() => {
    validator = new SolicitacaoValidator();
    CATEGORIAS_CONFIG['TESTE'] = { limiteBase: 1000.00 };
  });

  it('deve passar se o valor for menor que a base, mesmo sem justificativa', () => {
    const dto = { categoria: 'TESTE', valor: 900 } as CriarSolicitacaoDto;
    expect(() => validator.validarCriacao(dto)).not.toThrow();
  });

  it('deve lançar BadRequestException se o valor exceder a base e a justificativa for curta', () => {
    const dto = { 
      categoria: 'TESTE', 
      valor: 1500, 
      justificativa: '12345678901234567890123456789' 
    } as CriarSolicitacaoDto;
    
    expect(() => validator.validarCriacao(dto)).toThrow(BadRequestException);
  });

  it('deve passar se o valor exceder a base e a justificativa tiver 30 ou mais caracteres', () => {
    const dto = { 
      categoria: 'TESTE', 
      valor: 1500, 
      justificativa: 'Esta justificativa possui exatamente ou mais de 30 caracteres.' 
    } as CriarSolicitacaoDto;
    
    expect(() => validator.validarCriacao(dto)).not.toThrow();
  });
});