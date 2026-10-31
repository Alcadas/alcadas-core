import { Module } from '@nestjs/common';
import { AlcadasModule } from './alcadas/alcadas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [AlcadasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
