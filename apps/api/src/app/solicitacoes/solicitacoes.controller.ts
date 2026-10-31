import { Controller, Post, Get, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { SolicitacoesService } from './solicitacoes.service';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';

@Controller('api/solicitacoes')
@UseGuards(FirebaseAuthGuard)
export class SolicitacoesController {
  constructor(private readonly solicitacoesService: SolicitacoesService) {}

  @Post()
  async criar(@Body() dto: CriarSolicitacaoDto, @Req() req: any) {
    const tenantId = req.user.tenantId;
    const solicitanteId = req.user.uid;

    if (!tenantId || !solicitanteId) {
      throw new BadRequestException('Credenciais incompletas no token.');
    }

    return this.solicitacoesService.criarSolicitacao(dto, tenantId, solicitanteId);
  }

  @Get()
  async listar(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.solicitacoesService.listarPorTenant(tenantId);
  }
}