import { HttpErrorResponse } from '@angular/common/http';
import { mensagemDeErroDaApi } from './api-error';

describe('mensagemDeErroDaApi', () => {
  it('usa a mensagem do ErrorResponse da API', () => {
    const erro = new HttpErrorResponse({ status: 409, error: { statusCode: 409, message: 'Conflito de versão.' } });
    expect(mensagemDeErroDaApi(erro)).toBe('Conflito de versão.');
  });

  it('junta mensagens de validação em lista', () => {
    const erro = new HttpErrorResponse({ status: 400, error: { message: ['valor inválido', 'categoria obrigatória'] } });
    expect(mensagemDeErroDaApi(erro)).toBe('valor inválido; categoria obrigatória');
  });

  it('avisa quando a API está fora do ar (status 0)', () => {
    expect(mensagemDeErroDaApi(new HttpErrorResponse({ status: 0 }))).toContain('conectar à API');
  });

  it('usa a mensagem padrão para erros desconhecidos', () => {
    expect(mensagemDeErroDaApi(new Error('x'))).toBe('Não foi possível concluir a operação. Tente novamente.');
  });
});
