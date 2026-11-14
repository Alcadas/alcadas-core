import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Logs estruturados de requisição (Issue #35 / RNF09).
 *
 * Cada requisição HTTP gera exatamente UMA linha JSON no stdout com `requestId`, método, rota,
 * status e latência. A linha é montada a partir de uma lista fechada de campos: corpo, query string
 * e cabeçalhos nunca são lidos, então nomes, e-mails, tokens, senhas e justificativas não têm como
 * chegar ao log.
 *
 * Exemplo de linha:
 * {"timestamp":"2026-11-13T12:00:00.000Z","severity":"INFO","requestId":"0b0e…","metodo":"POST","rota":"/api/solicitacoes","status":201,"duracaoMs":85}
 */

/** Cabeçalho que devolve (e aceita) o identificador de correlação da requisição. */
export const CABECALHO_REQUEST_ID = 'X-Request-Id';

/** Chave em `res.locals` onde o filtro de erros anota o tipo da exceção de um 5xx. */
export const LOCAL_TIPO_ERRO = 'tipoErro';

/** Status registrado quando o cliente fecha a conexão antes de a resposta terminar. */
const STATUS_CLIENTE_DESCONECTOU = 499;

/** Formato aceito para um `X-Request-Id` vindo de fora: sem espaços, `@` ou quebras de linha. */
const REQUEST_ID_VALIDO = /^[A-Za-z0-9._-]{8,64}$/;

const TAMANHO_MAXIMO_ROTA = 200;
const TAMANHO_MAXIMO_SEGMENTO = 64;

/** Campos — e apenas estes — gravados por requisição. */
export interface LinhaLogRequisicao {
  timestamp: string;
  /** Nível no padrão do Cloud Logging / Render: INFO (<400), WARNING (4xx) ou ERROR (5xx). */
  severity: 'INFO' | 'WARNING' | 'ERROR';
  requestId: string;
  metodo: string;
  rota: string;
  status: number;
  duracaoMs: number;
  /** Só em 5xx: nome da classe da exceção (ex.: `TypeError`), nunca a mensagem. */
  erro?: string;
}

/** Função que recebe a linha JSON pronta. O padrão escreve no stdout. */
export type EscritorDeLog = (linha: string) => void;

type Proximo = (erro?: unknown) => void;
type Requisicao = IncomingMessage & { originalUrl?: string; requestId?: string };
type Resposta = ServerResponse & { locals?: Record<string, unknown> };

const escreverNoStdout: EscritorDeLog = (linha) => {
  process.stdout.write(`${linha}\n`);
};

/**
 * Reaproveita o `X-Request-Id` recebido quando ele tem formato seguro (permite correlacionar com o
 * frontend ou com um proxy); caso contrário gera um UUID v4.
 */
export function resolverRequestId(recebido: string | string[] | undefined): string {
  const candidato = Array.isArray(recebido) ? recebido[0] : recebido;
  return typeof candidato === 'string' && REQUEST_ID_VALIDO.test(candidato) ? candidato : randomUUID();
}

/**
 * Reduz a URL ao caminho que pode ser registrado:
 * - descarta a query string (filtros e buscas podem carregar dados pessoais);
 * - troca por um marcador qualquer segmento com cara de e-mail ou de token/segredo.
 */
export function sanitizarRota(url: string | undefined): string {
  const caminho = (url ?? '/').split(/[?#]/)[0] || '/';
  const segmentos = caminho.split('/').map((bruto) => {
    let segmento = bruto;
    try {
      segmento = decodeURIComponent(bruto);
    } catch {
      // Sequência %xx inválida: analisa o texto como veio.
    }
    if (segmento.includes('@')) {
      return ':email';
    }
    if (segmento.length > TAMANHO_MAXIMO_SEGMENTO || /^[\w-]{10,}\.[\w-]{10,}\.[\w-]*$/.test(segmento)) {
      return ':oculto';
    }
    return bruto;
  });
  return segmentos.join('/').slice(0, TAMANHO_MAXIMO_ROTA);
}

function nivelPara(status: number): LinhaLogRequisicao['severity'] {
  if (status >= 500) return 'ERROR';
  if (status >= 400) return 'WARNING';
  return 'INFO';
}

/**
 * Cria o middleware de log de requisições.
 *
 * Deve ser o primeiro middleware da aplicação (ver `configurarApp`), para que toda resposta —
 * inclusive 404, erros e preflight de CORS — saia com `X-Request-Id` e gere a sua linha.
 *
 * @param escrever destino da linha JSON; injetável para os testes capturarem a saída.
 *
 * @example
 * app.use(criarLogRequisicoes());
 */
export function criarLogRequisicoes(escrever: EscritorDeLog = escreverNoStdout) {
  return (req: Requisicao, res: Resposta, proximo: Proximo): void => {
    const inicio = process.hrtime.bigint();
    const requestId = resolverRequestId(req.headers['x-request-id']);
    req.requestId = requestId;
    res.setHeader(CABECALHO_REQUEST_ID, requestId);

    let registrado = false;
    const registrar = (): void => {
      // `finish` e `close` podem disparar os dois: a trava garante uma única linha por requisição.
      if (registrado) return;
      registrado = true;

      const status = res.writableFinished ? res.statusCode : STATUS_CLIENTE_DESCONECTOU;
      const tipoErro = res.locals?.[LOCAL_TIPO_ERRO];
      const linha: LinhaLogRequisicao = {
        timestamp: new Date().toISOString(),
        severity: nivelPara(status),
        requestId,
        metodo: req.method ?? 'GET',
        rota: sanitizarRota(req.originalUrl ?? req.url),
        status,
        duracaoMs: Math.round(Number(process.hrtime.bigint() - inicio) / 1e6),
        ...(status >= 500 && typeof tipoErro === 'string' ? { erro: tipoErro } : {}),
      };
      escrever(JSON.stringify(linha));
    };

    res.once('finish', registrar);
    res.once('close', registrar);
    proximo();
  };
}
