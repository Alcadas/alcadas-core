import { Controller, Post, Get, Body, Req, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { SolicitacoesService } from './solicitacoes.service';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { ListagemValidator } from './listagem.validator';

interface RequestComUsuario {
  user: { tenantId: string; uid: string };
}

@Controller('api/solicitacoes')
@UseGuards(FirebaseAuthGuard)
export class SolicitacoesController {
  constructor(
    private readonly solicitacoesService: SolicitacoesService,
    private readonly listagemValidator: ListagemValidator
  ) {}

  @Post()
  async criar(@Body() dto: CriarSolicitacaoDto, @Req() req: RequestComUsuario) {
    const tenantId = req.user.tenantId;
    const solicitanteId = req.user.uid;

    if (!tenantId || !solicitanteId) {
      throw new BadRequestException('Credenciais institucionais incompletas no token.');
    }

    return this.solicitacoesService.criarSolicitacao(dto, tenantId, solicitanteId);
  }

  @Get()
  async listar(@Query() query: Record<string, string>, @Req() req: RequestComUsuario) {
    const tenantId = req.user.tenantId;
    const parametros = this.listagemValidator.validar(query);

    return this.solicitacoesService.listarPorTenant(tenantId, parametros);
  }
}