import { BadRequestException, Injectable } from '@nestjs/common';
import { JUSTIFICATIVA_MINIMA_ACIMA_DA_BASE } from '@alcadas-core/models';
import { CATEGORIAS_CONFIG } from './categorias.config';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';

@Injectable()
export class SolicitacaoValidator {
  validarCriacao(dto: CriarSolicitacaoDto): void {
    const config = CATEGORIAS_CONFIG[dto.categoria];
    
    if (!config) {
      throw new BadRequestException(`Categoria ${dto.categoria} não reconhecida.`);
    }

    if (typeof dto.valor !== 'number' || isNaN(dto.valor) || dto.valor <= 0) {
      throw new BadRequestException('CA-02.3: O valor da solicitação deve ser maior que zero.');
    }

    const partesValor = dto.valor.toString().split('.');
    if (partesValor.length > 1 && partesValor[1].length > 2) {
      throw new BadRequestException('CA-02.3: O valor da solicitação deve possuir no máximo duas casas decimais.');
    }

    if (dto.valor > config.limiteBase) {
      if (!dto.justificativa || dto.justificativa.trim().length < JUSTIFICATIVA_MINIMA_ACIMA_DA_BASE) {
        throw new BadRequestException(`Para valores acima da base da categoria, a justificativa deve conter no mínimo ${JUSTIFICATIVA_MINIMA_ACIMA_DA_BASE} caracteres.`);
      }
    }
  }
}