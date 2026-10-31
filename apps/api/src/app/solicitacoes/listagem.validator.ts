import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class ListagemValidator {
  validar(query: Record<string, string | undefined>): { status?: string; page: number; limit: number } {
    const statusValidos = ['PENDENTE', 'EM_AJUSTE', 'APROVADA', 'REJEITADA'];
    
    if (query.status && !statusValidos.includes(query.status)) {
      throw new BadRequestException('Status de filtro inválido. Valores permitidos: PENDENTE, EM_AJUSTE, APROVADA, REJEITADA.');
    }

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);

    if (isNaN(page) || page < 1) {
      throw new BadRequestException('O parâmetro "page" deve ser um número inteiro maior que zero.');
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('O parâmetro "limit" deve ser um número inteiro entre 1 e 100.');
    }

    return { status: query.status, page, limit };
  }
}