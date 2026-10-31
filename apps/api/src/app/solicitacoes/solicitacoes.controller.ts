import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  DecisaoAjusteDto,
  DecisaoAprovacaoDto,
  DecisaoRejeicaoDto,
  SolicitacaoResponseDto,
} from '@alcadas-core/models';
import { CurrentUser } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SolicitacoesService } from './solicitacoes.service';

@Controller('solicitacoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitacoesController {
  constructor(private readonly solicitacoesService: SolicitacoesService) {}

  /**
   * T02: POST /api/solicitacoes/:id/aprovar
   */
  @Post(':id/aprovar')
  @HttpCode(HttpStatus.OK)
  async aprovar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecisaoAprovacaoDto,
  ): Promise<SolicitacaoResponseDto> {
    return this.solicitacoesService.aprovarSolicitacao(user, id, dto);
  }

  /**
   * T03: POST /api/solicitacoes/:id/rejeitar
   */
  @Post(':id/rejeitar')
  @HttpCode(HttpStatus.OK)
  async rejeitar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecisaoRejeicaoDto,
  ): Promise<SolicitacaoResponseDto> {
    return this.solicitacoesService.rejeitarSolicitacao(user, id, dto);
  }

  /**
   * T04: POST /api/solicitacoes/:id/ajuste
   */
  @Post(':id/ajuste')
  @HttpCode(HttpStatus.OK)
  async solicitarAjuste(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecisaoAjusteDto,
  ): Promise<SolicitacaoResponseDto> {
    return this.solicitacoesService.solicitarAjuste(user, id, dto);
  }
}
