import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { SolicitacoesController } from './solicitacoes.controller';
import { SolicitacoesService } from './solicitacoes.service';
import { SolicitacaoValidator } from './solicitacao.validator';
import { FirestoreSolicitacoesRepository } from './firestore-solicitacoes.repository';
import { SOLICITACOES_REPOSITORY } from './solicitacoes.repository';
import { ListagemValidator} from './listagem.validator';
=======
import { AuditoriaService } from '../auditoria/auditoria.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { FirestoreService } from '../database/firestore.service';
import { SolicitacoesController } from './solicitacoes.controller';
import { SolicitacoesService } from './solicitacoes.service';
>>>>>>> origin/develop

@Module({
  controllers: [SolicitacoesController],
  providers: [
<<<<<<< HEAD
    ListagemValidator,
    SolicitacaoValidator,
    SolicitacoesService,
    {
      provide: SOLICITACOES_REPOSITORY,
      useClass: FirestoreSolicitacoesRepository
    }
  ],
})
export class SolicitacoesModule {}
=======
    FirestoreService,
    AuditoriaService,
    JwtAuthGuard,
    RolesGuard,
    SolicitacoesService,
  ],
  exports: [SolicitacoesService, AuditoriaService, FirestoreService],
})
export class SolicitacoesModule {}
>>>>>>> origin/develop
