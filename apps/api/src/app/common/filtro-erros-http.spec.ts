import { ArgumentsHost, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FiltroErrosHttp } from './filtro-erros-http';

function executar(excecao: unknown) {
  const resposta = {
    codigo: 0,
    corpo: undefined as Record<string, unknown> | undefined,
    status(c: number) {
      this.codigo = c;
      return this;
    },
    json(c: Record<string, unknown>) {
      this.corpo = c;
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => resposta }) } as unknown as ArgumentsHost;
  new FiltroErrosHttp().catch(excecao, host);
  return resposta;
}

describe('FiltroErrosHttp', () => {
  it('formata HttpException no padrão statusCode/error/message/timestamp', () => {
    const r = executar(new ForbiddenException('Sem permissão'));
    expect(r.codigo).toBe(403);
    expect(r.corpo?.['statusCode']).toBe(403);
    expect(r.corpo?.['error']).toBe('Forbidden');
    expect(r.corpo?.['message']).toBe('Sem permissão');
    expect(typeof r.corpo?.['timestamp']).toBe('string');
  });

  it('preserva a lista de erros de validação', () => {
    const erros = [{ campo: 'valor', mensagem: 'Campo obrigatório' }];
    const r = executar(
      new BadRequestException({ statusCode: 400, error: 'Bad Request', message: 'Dados inválidos', erros }),
    );
    expect(r.codigo).toBe(400);
    expect(r.corpo?.['erros']).toEqual(erros);
  });

  it('erro desconhecido vira 500 sem vazar detalhes', () => {
    const r = executar(new Error('senha=123 stack interna'));
    expect(r.codigo).toBe(500);
    expect(r.corpo?.['message']).toBe('Erro interno do servidor');
  });
});