import { Module } from '@nestjs/common';
import { FirestoreService } from '../database/firestore.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AlcadasController } from './alcadas.controller';
import { AlcadasService } from './alcadas.service';
import { ProvisionamentoColaboradoresService } from './provisionamento-colaboradores.service';
import { SaasController } from './saas.controller';

@Module({
  controllers: [AlcadasController, SaasController],
  providers: [
    FirestoreService,
    JwtAuthGuard,
    RolesGuard,
    AlcadasService,
    ProvisionamentoColaboradoresService,
  ],
  exports: [AlcadasService, FirestoreService],
})
export class AlcadasModule {}
