import { Module } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { FirestoreService } from '../database/firestore.service';
import { SolicitacoesController } from './solicitacoes.controller';
import { SolicitacoesService } from './solicitacoes.service';

@Module({
  controllers: [SolicitacoesController],
  providers: [
    FirestoreService,
    AuditoriaService,
    JwtAuthGuard,
    RolesGuard,
    SolicitacoesService,
  ],
  exports: [SolicitacoesService, AuditoriaService, FirestoreService],
})
export class SolicitacoesModule {}
