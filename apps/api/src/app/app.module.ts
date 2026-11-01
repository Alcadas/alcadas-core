import { Module } from '@nestjs/common';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module';
import { APP_FILTER } from '@nestjs/core';
import { FiltroErrosHttp } from './common/filtro-erros-http';

@Module({
  imports: [SolicitacoesModule],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: FiltroErrosHttp,
    },
  ],
})
export class AppModule {}