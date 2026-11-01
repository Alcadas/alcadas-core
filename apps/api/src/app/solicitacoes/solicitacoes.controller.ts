import {
  Body,
  Controller,
  Get,
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
  EloAuditoriaDto,
  SolicitacaoResponseDto,
  UserRole,
} from '@alcadas-core/models';
import { VerificacaoTrilhaResultado } from '../auditoria/auditoria.service';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SolicitacoesService } from './solicitacoes.service';

/** Papéis com competência de decisão (ADR-007). A alçada e o SoD são conferidos no caso de uso. */
export const PAPEIS_APROVADORES: UserRole[] = [
  'USER_NORMAL',
  'SUPER_USER',
  'APROVADOR_N1',
  'APROVADOR_N2',
  'DIRETOR_CFO',
];

/** Papéis que podem consultar/verificar a trilha (o solicitante só a do próprio pedido). */
export const PAPEIS_LEITURA_TRILHA: UserRole[] = [
  ...PAPEIS_APROVADORES,
  'SOLICITANTE',
  'AUDITOR',
  'ADMIN',
];

@Controller('solicitacoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitacoesController {
  constructor(private readonly solicitacoesService: SolicitacoesService) {}

  /**
   * T02: POST /api/solicitacoes/:id/aprovar
   */
  @Post(':id/aprovar')
  @Roles(...PAPEIS_APROVADORES)
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
  @Roles(...PAPEIS_APROVADORES)
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
  @Roles(...PAPEIS_APROVADORES)
  @HttpCode(HttpStatus.OK)
  async solicitarAjuste(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecisaoAjusteDto,
  ): Promise<SolicitacaoResponseDto> {
    return this.solicitacoesService.solicitarAjuste(user, id, dto);
  }

  /**
   * GET /api/solicitacoes/:id/trilha — linha do tempo com os elos SHA-256 (US-07).
   */
  @Get(':id/trilha')
  @Roles(...PAPEIS_LEITURA_TRILHA)
  async obterTrilha(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<EloAuditoriaDto[]> {
    return this.solicitacoesService.obterTrilha(user, id);
  }

  /**
   * POST /api/solicitacoes/:id/trilha/verificar — recalcula a cadeia e aponta o elo adulterado (US-08).
   */
  @Post(':id/trilha/verificar')
  @Roles(...PAPEIS_LEITURA_TRILHA)
  @HttpCode(HttpStatus.OK)
  async verificarTrilha(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<VerificacaoTrilhaResultado> {
    return this.solicitacoesService.verificarTrilha(user, id);
  }
}
