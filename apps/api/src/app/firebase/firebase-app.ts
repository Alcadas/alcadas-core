import { App, cert, Credential, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app';

/** Projeto fictício dos emuladores locais (prefixo `demo-` nunca fala com a nuvem). */
const PROJETO_DOS_EMULADORES = 'demo-alcadas';

/**
 * Lê a credencial da conta de serviço de `FIREBASE_SERVICE_ACCOUNT_JSON`, aceitando o JSON puro ou
 * o mesmo JSON em base64 (mais simples de colar em painéis como o do Render).
 *
 * Sem a variável devolve `undefined`, e o Admin SDK usa as Application Default Credentials
 * (`GOOGLE_APPLICATION_CREDENTIALS` ou a identidade do próprio ambiente Google Cloud).
 *
 * A chave nunca é versionada: vive só nas variáveis de ambiente do serviço (ADR-011 / #51).
 */
function lerContaDeServico(): (ServiceAccount & { project_id?: string }) | undefined {
  const bruto = process.env['FIREBASE_SERVICE_ACCOUNT_JSON']?.trim();
  if (!bruto) {
    return undefined;
  }
  try {
    const texto = bruto.startsWith('{') ? bruto : Buffer.from(bruto, 'base64').toString('utf8');
    return JSON.parse(texto) as ServiceAccount & { project_id?: string };
  } catch {
    // A mensagem não inclui o conteúdo da variável para não vazar a chave privada no log.
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválida: esperado o JSON da conta de serviço (puro ou em base64).');
  }
}

/**
 * Devolve a instância única do Firebase Admin usada por Auth e Firestore.
 *
 * - Fora de produção aponta para os emuladores (Auth em 9099, Firestore em 8080), a menos que as
 *   variáveis `*_EMULATOR_HOST` já estejam definidas — é o que mantém `npm run docker:up` e os
 *   testes funcionando sem credencial alguma.
 * - Em produção NÃO define emulador: o Admin SDK fala com o Firebase real usando a conta de serviço
 *   (`FIREBASE_SERVICE_ACCOUNT_JSON`) ou as credenciais padrão do ambiente (#29).
 *
 * A inicialização é preguiçosa: uma credencial ausente ou inválida não impede a API de subir;
 * o erro aparece na primeira operação e é reportado por `/api/readyz` (503).
 */
export function getFirebaseApp(): App {
  if (process.env['NODE_ENV'] !== 'production') {
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= 'localhost:9099';
    process.env['FIRESTORE_EMULATOR_HOST'] ??= 'localhost:8080';
  }
  const existente = getApps()[0];
  if (existente) {
    return existente;
  }

  const contaDeServico = lerContaDeServico();
  const credential: Credential | undefined = contaDeServico ? cert(contaDeServico) : undefined;
  return initializeApp({
    projectId: process.env['FIREBASE_PROJECT_ID'] ?? contaDeServico?.project_id ?? PROJETO_DOS_EMULADORES,
    ...(credential ? { credential } : {}),
  });
}
