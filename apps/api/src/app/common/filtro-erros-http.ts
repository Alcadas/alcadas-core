import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { LOCAL_TIPO_ERRO } from './log-requisicoes';

/**
 * Filtro global de erros: toda resposta de erro sai no formato
 * `{ statusCode, error, message, erros?, timestamp }`.
 *
 * Exceções não previstas viram 500 com mensagem genérica — a mensagem original e o stack trace
 * nunca vão para o cliente nem para o log (RNF09). Só o nome da classe do erro é anotado em
 * `res.locals`, de onde o middleware de log o inclui na linha JSON da própria requisição (#35),
 * mantendo uma única linha por requisição.
 */
@Catch()
export class FiltroErrosHttp implements ExceptionFilter {
  catch(excecao: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse();
    const timestamp = new Date().toISOString();

    if (excecao instanceof HttpException) {
      const status = excecao.getStatus();
      const conteudo = excecao.getResponse();
      const corpo: Record<string, unknown> =
        typeof conteudo === 'string' ? { message: conteudo } : (conteudo as Record<string, unknown>);

      if (status >= 500) {
        this.anotarTipoDoErro(resposta, excecao);
      }

      resposta.status(status).json({
        statusCode: status,
        error: corpo['error'] ?? 'Error',
        message: corpo['message'] ?? excecao.message,
        ...(corpo['erros'] ? { erros: corpo['erros'] } : {}),
        timestamp,
      });
      return;
    }

    this.anotarTipoDoErro(resposta, excecao);
    resposta.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Erro interno do servidor',
      timestamp,
    });
  }

  /** Guarda apenas o tipo da exceção (ex.: `TypeError`) para o log da requisição. */
  private anotarTipoDoErro(resposta: { locals?: Record<string, unknown> }, excecao: unknown): void {
    if (resposta.locals) {
      resposta.locals[LOCAL_TIPO_ERRO] = excecao instanceof Error ? excecao.name : typeof excecao;
    }
  }
}
