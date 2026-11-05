import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { FirestoreService } from '../database/firestore.service';

/**
 * Rotas públicas de saúde (sem guard de autenticação).
 * - `/api/healthz`: o processo está de pé (liveness).
 * - `/api/readyz`: a API consegue falar com o Firestore (readiness) — 503 quando não consegue.
 */
@Controller()
export class HealthController {
  constructor(private readonly firestore: FirestoreService) {}

  @Get('healthz')
  @HttpCode(HttpStatus.OK)
  healthz(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  @HttpCode(HttpStatus.OK)
  async readyz(): Promise<{ status: 'ok'; firestore: 'ok' }> {
    const firestoreOk = await this.firestore.ping();
    if (!firestoreOk) {
      throw new ServiceUnavailableException({
        error: 'NAO_PRONTO',
        message: 'Firestore indisponível.',
      });
    }
    return { status: 'ok', firestore: 'ok' };
  }
}
