import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

@Catch()
export class FiltroErrosHttp implements ExceptionFilter {
  private readonly logger = new Logger(FiltroErrosHttp.name);

  catch(excecao: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse();
    const timestamp = new Date().toISOString();

    if (excecao instanceof HttpException) {
      const status = excecao.getStatus();
      const conteudo = excecao.getResponse();
      const corpo: Record<string, unknown> =
        typeof conteudo === 'string' ? { message: conteudo } : (conteudo as Record<string, unknown>);

      resposta.status(status).json({
        statusCode: status,
        error: corpo['error'] ?? 'Error',
        message: corpo['message'] ?? excecao.message,
        ...(corpo['erros'] ? { erros: corpo['erros'] } : {}),
        timestamp,
      });
      return;
    }

    this.logger.error(excecao instanceof Error ? excecao.message : 'Erro desconhecido');
    resposta.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Erro interno do servidor',
      timestamp,
    });
  }
}