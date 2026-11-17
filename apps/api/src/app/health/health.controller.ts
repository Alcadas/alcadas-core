import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { FirestoreService } from '../database/firestore.service';

/**
 * Rotas públicas de saúde (sem guard de autenticação).
 * - `/api/healthz`: o processo está de pé (liveness).
 * - `/api/readyz`: a API consegue falar com o Firestore (readiness) — 503 quando não consegue.
 *   Em produção consulta o Firestore real, com o resultado saudável reaproveitado por 60 s para não
 *   gastar a cota de leituras do plano Spark (ver `FirestoreService.ping` — #29).
 *
 * @example
 * curl -i https://<api>/api/readyz   # 200 {"status":"ok","firestore":"ok"} | 503 {"error":"NAO_PRONTO",...}
 */
@Controller()
export class HealthController {
  constructor(private readonly firestore: FirestoreService) {}

  @Get('healthz')
  @HttpCode(HttpStatus.OK)
  healthz(): { status: 'ok'; commit?: string } {
    const commit = process.env['RENDER_GIT_COMMIT'] ?? process.env['COMMIT_SHA'];
    return {
      status: 'ok',
      ...(commit ? { commit } : {}),
    };
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
