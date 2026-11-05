import { ServiceUnavailableException } from '@nestjs/common';
import { FirestoreService } from '../database/firestore.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  function controllerCom(firestoreOk: boolean): HealthController {
    const firestore = { ping: jest.fn().mockResolvedValue(firestoreOk) } as unknown as FirestoreService;
    return new HealthController(firestore);
  }

  it('/healthz responde ok sem depender do banco', () => {
    expect(controllerCom(false).healthz()).toEqual({ status: 'ok' });
  });

  it('/healthz inclui o commit SHA quando definido em variavel de ambiente', () => {
    process.env['RENDER_GIT_COMMIT'] = 'a1b2c3d4e5';
    try {
      expect(controllerCom(false).healthz()).toEqual({ status: 'ok', commit: 'a1b2c3d4e5' });
    } finally {
      delete process.env['RENDER_GIT_COMMIT'];
    }
  });

  it('/readyz responde ok quando o Firestore está acessível', async () => {
    await expect(controllerCom(true).readyz()).resolves.toEqual({ status: 'ok', firestore: 'ok' });
  });

  it('/readyz responde 503 quando o Firestore está fora', async () => {
    await expect(controllerCom(false).readyz()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
