import { Module } from '@nestjs/common';
import { AlcadasModule } from './alcadas/alcadas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module';

@Module({
  imports: [AlcadasModule, SolicitacoesModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
