import { INestApplication } from '@nestjs/common';
import { resolverOrigensCors } from './cors';
import { FiltroErrosHttp } from './filtro-erros-http';
import { CABECALHO_REQUEST_ID, criarLogRequisicoes, EscritorDeLog } from './log-requisicoes';

/** Prefixo de todas as rotas da API (`/api/...`). */
export const PREFIXO_GLOBAL = 'api';

export interface OpcoesConfiguracaoApp {
  /** Destino das linhas de log de requisição. Padrão: stdout. */
  escreverLog?: EscritorDeLog;
}

/**
 * Aplica a configuração HTTP transversal da API. Fica fora do `main.ts` para que os testes subam a
 * aplicação exatamente como a produção sobe.
 *
 * A ordem importa:
 * 1. log de requisições — primeiro, para que toda resposta (inclusive preflight de CORS e 404)
 *    tenha `X-Request-Id` e gere a sua linha JSON (#35);
 * 2. filtro global de erros — padroniza o corpo dos erros sem vazar detalhes internos;
 * 3. CORS — restrito às origens da equipe (#34). `X-Request-Id` é exposto para o frontend poder
 *    informar o identificador ao reportar um erro.
 */
export function configurarApp(app: INestApplication, opcoes: OpcoesConfiguracaoApp = {}): void {
  app.setGlobalPrefix(PREFIXO_GLOBAL);
  app.use(criarLogRequisicoes(opcoes.escreverLog));
  app.useGlobalFilters(new FiltroErrosHttp());
  app.enableCors({
    origin: resolverOrigensCors(),
    exposedHeaders: [CABECALHO_REQUEST_ID],
  });
}
