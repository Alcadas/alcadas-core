import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ErrorResponse } from '@alcadas-core/models';

/**
 * Filtro global que padroniza todas as respostas de erro HTTP conforme o contrato OpenAPI v0.1
 * e garante que nenhum dado sensível (PII/tokens) seja vazado (RNF09).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: ErrorResponse) => void };
    }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Erro interno no servidor.';
    let errorName = HttpStatus[status] || 'Error';

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (Array.isArray(resObj['message'])) {
          message = resObj['message'].join('; ');
        } else if (typeof resObj['message'] === 'string') {
          message = resObj['message'];
        }
        if (typeof resObj['error'] === 'string') {
          errorName = resObj['error'];
        }
      }
    }

    const payload: ErrorResponse = {
      statusCode: status,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(payload);
  }
}
