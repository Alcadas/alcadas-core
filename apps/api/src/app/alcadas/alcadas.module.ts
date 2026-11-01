import { Module } from '@nestjs/common';
import { FirestoreService } from '../database/firestore.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AlcadasController } from './alcadas.controller';
import { AlcadasService } from './alcadas.service';

@Module({
  controllers: [AlcadasController],
  providers: [FirestoreService, JwtAuthGuard, RolesGuard, AlcadasService],
  exports: [AlcadasService, FirestoreService],
})
export class AlcadasModule {}
