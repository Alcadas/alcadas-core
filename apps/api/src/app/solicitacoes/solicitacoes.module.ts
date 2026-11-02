import { Module } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { FirestoreService } from '../database/firestore.service';
import { DecisoesController } from './decisoes.controller';
import { DecisoesService } from './decisoes.service';
import { FirestoreSolicitacoesRepository } from './firestore-solicitacoes.repository';
import { ListagemValidator } from './listagem.validator';
import { MaquinaEstadosService } from './maquina-estados.service';
import { SolicitacaoValidator } from './solicitacao.validator';
import { SolicitacoesController } from './solicitacoes.controller';
import { SOLICITACOES_REPOSITORY } from './solicitacoes.repository';
import { SolicitacoesService } from './solicitacoes.service';

@Module({
  // Submissão e listagem (Jornada 2) + decisão e trilha (Jornadas 3 e 5)
  controllers: [SolicitacoesController, DecisoesController],
  providers: [
    ListagemValidator,
    SolicitacaoValidator,
    SolicitacoesService,
    {
      provide: SOLICITACOES_REPOSITORY,
      useClass: FirestoreSolicitacoesRepository,
    },
    FirestoreService,
    AuditoriaService,
    JwtAuthGuard,
    RolesGuard,
    MaquinaEstadosService,
    DecisoesService,
  ],
  exports: [DecisoesService, MaquinaEstadosService, AuditoriaService, FirestoreService],
})
export class SolicitacoesModule {}
