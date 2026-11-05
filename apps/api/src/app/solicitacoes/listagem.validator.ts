import { BadRequestException, Injectable } from '@nestjs/common';

/** Limite máximo de itens por página (contrato OpenAPI v0.2 — FinOps). */
export const LIMITE_MAXIMO_POR_PAGINA = 50;
const LIMITE_PADRAO_POR_PAGINA = 20;

@Injectable()
export class ListagemValidator {
  validar(query: Record<string, string | undefined>): { status?: string; page: number; limit: number } {
    const statusValidos = ['PENDENTE', 'EM_AJUSTE', 'APROVADA', 'REJEITADA'];
    
    if (query.status && !statusValidos.includes(query.status)) {
      throw new BadRequestException('Status de filtro inválido. Valores permitidos: PENDENTE, EM_AJUSTE, APROVADA, REJEITADA.');
    }

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || String(LIMITE_PADRAO_POR_PAGINA), 10);

    if (isNaN(page) || page < 1) {
      throw new BadRequestException('O parâmetro "page" deve ser um número inteiro maior que zero.');
    }

    if (isNaN(limit) || limit < 1 || limit > LIMITE_MAXIMO_POR_PAGINA) {
      throw new BadRequestException(`O parâmetro "limit" deve ser um número inteiro entre 1 e ${LIMITE_MAXIMO_POR_PAGINA}.`);
    }

    return { status: query.status, page, limit };
  }
}