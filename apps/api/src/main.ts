import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { FiltroErrosHttp } from './app/common/filtro-erros-http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new FiltroErrosHttp());
  // Origens do frontend liberadas no CORS, separadas por vírgula (Plano Custo Zero — ADR-011).
  const origensPermitidas = (process.env['WEB_URL'] ?? 'http://localhost:4200').split(',').map((o) => o.trim());
  app.enableCors({ origin: origensPermitidas });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();