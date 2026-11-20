import { waitForPortOpen } from '@nx/node/utils';
import { execFileSync } from 'child_process';
import * as path from 'path';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

/**
 * Carrega o seed (`scripts/seed.ts`) nos emuladores antes dos testes, para que as suítes usem os
 * mesmos dados em toda execução: empresas `startop` e `empresa-b`, usuários, centros de custo e as
 * solicitações `sol-startop-01` e `sol-empresa-b-01`.
 *
 * Só roda quando os emuladores estão ativos (variáveis definidas pelo `firebase emulators:exec`).
 * As opções do TypeScript vão por variável de ambiente para funcionar igual no Linux (CI) e no
 * Windows — o script `npm run seed` usa aspas simples, que o cmd do Windows não entende.
 */
function carregarSeed(): void {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.warn('\n[seed] Emuladores não detectados: seed não carregado.\n');
    return;
  }

  const raiz = path.resolve(__dirname, '../../../..');
  execFileSync(
    process.execPath,
    [require.resolve('ts-node/dist/bin.js'), '-T', path.join(raiz, 'scripts', 'seed.ts')],
    {
      cwd: raiz,
      stdio: 'inherit',
      env: {
        ...process.env,
        TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: 'NodeNext', moduleResolution: 'NodeNext' }),
      },
    },
  );
}

module.exports = async function() {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nSetting up...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await waitForPortOpen(port, { host });

  carregarSeed();

  // Hint: Use `globalThis` to pass variables to global teardown.
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
