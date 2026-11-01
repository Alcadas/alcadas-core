import { Module } from '@nestjs/common';
import { SolicitacoesController } from './solicitacoes.controller';
import { SolicitacoesService } from './solicitacoes.service';
import { SolicitacaoValidator } from './solicitacao.validator';
import { FirestoreSolicitacoesRepository } from './firestore-solicitacoes.repository';
import { SOLICITACOES_REPOSITORY } from './solicitacoes.repository';
import { ListagemValidator} from './listagem.validator';

@Module({
  controllers: [SolicitacoesController],
  providers: [
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
