import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AlcadasModule } from './alcadas/alcadas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FiltroErrosHttp } from './common/filtro-erros-http';
import { HealthController } from './health/health.controller';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module';

@Module({
  imports: [AlcadasModule, SolicitacoesModule],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: FiltroErrosHttp,
    },
  ],
})
export class AppModule {}
