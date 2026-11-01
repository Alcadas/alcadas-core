import { ListagemValidator } from './listagem.validator';
import { BadRequestException } from '@nestjs/common';

describe('ListagemValidator', () => {
  let validator: ListagemValidator;

  beforeEach(() => {
    validator = new ListagemValidator();
  });

  it('deve retornar paginação padrão quando não houver query params', () => {
    const result = validator.validar({});
    expect(result).toEqual({ status: undefined, page: 1, limit: 20 });
  });

  it('deve aceitar status válidos', () => {
    const result = validator.validar({ status: 'PENDENTE' });
    expect(result.status).toBe('PENDENTE');
  });

  it('deve lançar erro para status inválido', () => {
    expect(() => validator.validar({ status: 'INVENTADO' })).toThrow(BadRequestException);
  });

  it('deve lançar erro para page ou limit inválidos', () => {
    expect(() => validator.validar({ page: '0' })).toThrow(BadRequestException);
    expect(() => validator.validar({ limit: '101' })).toThrow(BadRequestException);
  });
});