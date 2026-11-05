import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UsuarioAtual, UsuarioAutenticado } from '../auth/usuario-autenticado';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { ListagemValidator } from './listagem.validator';
import { SolicitacoesService } from './solicitacoes.service';

/**
 * Jornada 2 — submissão e listagem de solicitações.
 * O tenant e o autor vêm sempre do token validado pelo FirebaseAuthGuard (ADR-009).
 */
@Controller('solicitacoes')
@UseGuards(FirebaseAuthGuard)
export class SolicitacoesController {
  constructor(
    private readonly solicitacoesService: SolicitacoesService,
    private readonly listagemValidator: ListagemValidator,
  ) {}

  @Post()
  async criar(@Body() dto: CriarSolicitacaoDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.solicitacoesService.criarSolicitacao(dto, usuario.tenantId, usuario.uid);
  }

  @Get()
  async listar(
    @Query() query: Record<string, string>,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    const parametros = this.listagemValidator.validar(query);
    return this.solicitacoesService.listarPorTenant(usuario.tenantId, parametros);
  }
}
