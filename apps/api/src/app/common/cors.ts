/**
 * Origens liberadas no CORS da API (Issue #34 / ADR-011).
 *
 * Só entram na lista:
 * 1. as origens fixas de `WEB_URL` (separadas por vírgula) — em produção, o domínio oficial do
 *    Firebase Hosting;
 * 2. os canais de preview do Firebase Hosting do próprio projeto, cujo endereço muda a cada PR
 *    (`https://<site>--pr12-abc123.web.app`).
 *
 * Qualquer outra origem fica sem o cabeçalho `Access-Control-Allow-Origin` e é barrada pelo navegador.
 */

/** Origem usada no desenvolvimento local quando `WEB_URL` não está definida. */
const ORIGEM_LOCAL_PADRAO = 'http://localhost:4200';

/** Identificador válido de um site do Firebase Hosting (evita injetar regex pela variável de ambiente). */
const SITE_HOSTING_VALIDO = /^[a-z0-9][a-z0-9-]{0,62}$/;

type Ambiente = Record<string, string | undefined>;

/**
 * Monta a expressão que casa apenas com os canais de preview do site informado.
 * Retorna `null` quando o nome do site é inválido.
 *
 * @example
 * padraoCanaisDePreview('alcadas-app')?.test('https://alcadas-app--pr12-abc123.web.app'); // true
 * padraoCanaisDePreview('alcadas-app')?.test('https://alcadas-app.evil.com');             // false
 */
export function padraoCanaisDePreview(site: string | undefined): RegExp | null {
  if (!site || !SITE_HOSTING_VALIDO.test(site)) {
    return null;
  }
  return new RegExp(`^https://${site}--[a-z0-9-]+\\.web\\.app$`);
}

/**
 * Resolve a lista de origens aceitas a partir das variáveis de ambiente:
 * - `WEB_URL`: origens fixas, separadas por vírgula. Sem ela, só o desenvolvimento local recebe
 *   `http://localhost:4200`; em produção nada é liberado por padrão.
 * - `FIREBASE_HOSTING_SITE` (ou, na falta, `FIREBASE_PROJECT_ID`): site cujos canais de preview
 *   são aceitos.
 */
export function resolverOrigensCors(env: Ambiente = process.env): Array<string | RegExp> {
  const producao = env['NODE_ENV'] === 'production';
  const fixas = (env['WEB_URL'] ?? (producao ? '' : ORIGEM_LOCAL_PADRAO))
    .split(',')
    .map((origem) => origem.trim().replace(/\/+$/, ''))
    .filter((origem) => origem.length > 0);

  const preview = padraoCanaisDePreview(env['FIREBASE_HOSTING_SITE'] ?? env['FIREBASE_PROJECT_ID']);
  return preview ? [...fixas, preview] : fixas;
}
