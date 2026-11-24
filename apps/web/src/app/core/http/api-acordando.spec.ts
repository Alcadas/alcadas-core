import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError, defer, throwError } from 'rxjs';
import { falhaDeApiAcordando } from './api-acordando';
import { mensagemDeErroDaApi } from './api-error';

describe('falhaDeApiAcordando', () => {
  it.each([0, 502, 503, 504])('tenta de novo quando o status é %i (API acordando ou fora do ar)', (status) => {
    expect(falhaDeApiAcordando(new HttpErrorResponse({ status }))).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 500])('não repete erros de negócio ou de servidor (%i)', (status) => {
    expect(falhaDeApiAcordando(new HttpErrorResponse({ status }))).toBe(false);
  });

  it('tenta de novo quando a tentativa estoura o tempo limite', () => {
    let erro: unknown;
    defer(() => throwError(() => new TimeoutError())).subscribe({ error: (e) => (erro = e) });
    expect(falhaDeApiAcordando(erro)).toBe(true);
  });

  it('explica o tempo esgotado para o usuário', () => {
    expect(mensagemDeErroDaApi(new TimeoutError())).toContain('demorou demais');
  });
});
