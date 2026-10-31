import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module';

@Module({
  imports: [SolicitacoesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
