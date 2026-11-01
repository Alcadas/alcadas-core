import { BadRequestException, Injectable } from '@nestjs/common';
import { CATEGORIAS_CONFIG } from './categorias.config';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';

@Injectable()
export class SolicitacaoValidator {
  validarCriacao(dto: CriarSolicitacaoDto): void {
    const config = CATEGORIAS_CONFIG[dto.categoria];
    
    if (!config) {
      throw new BadRequestException(`Categoria ${dto.categoria} não reconhecida.`);
    }

    if (dto.valor > config.limiteBase) {
      if (!dto.justificativa || dto.justificativa.length < 30) {
        throw new BadRequestException('Para valores acima da base da categoria, a justificativa deve conter no mínimo 30 caracteres.');
      }
    }
  }
}