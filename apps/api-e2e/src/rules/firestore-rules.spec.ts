import {
  initializeTestEnvironment,
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore Security Rules: Deny-All (CP2)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rawHost = process.env['FIRESTORE_EMULATOR_HOST'] || '127.0.0.1:8080';
    const [host, portStr] = rawHost.replace(/^https?:\/\//, '').split(':');
    const port = Number(portStr || 8080);

    testEnv = await initializeTestEnvironment({
      projectId: 'demo-alcadas',
      firestore: {
        host,
        port,
        rules: fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('deve negar leitura direta do navegador para qualquer documento (autenticado)', async () => {
    const navegador = testEnv.authenticatedContext('ana', { tenantId: 'startop' }).firestore();
    await assertFails(getDoc(doc(navegador, 'solicitacoes/qualquer')));
    await assertFails(getDoc(doc(navegador, 'tenants/startop/requests/qualquer')));
  });

  it('deve negar escrita direta do navegador para criacao ou mutacao (autenticado)', async () => {
    const navegador = testEnv.authenticatedContext('ana', { tenantId: 'startop' }).firestore();
    await assertFails(setDoc(doc(navegador, 'solicitacoes/nova'), { valor: 10 }));
    await assertFails(setDoc(doc(navegador, 'tenants/startop/requests/nova'), { valor: 10 }));
  });

  it('deve negar leitura e escrita de usuarios anonimos (nao autenticados)', async () => {
    const anonimo = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonimo, 'solicitacoes/qualquer')));
    await assertFails(setDoc(doc(anonimo, 'solicitacoes/nova'), { valor: 10 }));
  });
});
