import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { connect } from 'node:net';
import { getFirebaseApp } from '../firebase/firebase-app';

/** O documento mudou entre a leitura e a escrita (concorrência otimista). */
export class ConflitoDeVersaoError extends Error {
  constructor(readonly path: string) {
    super(`Conflito de versão em ${path}`);
    this.name = 'ConflitoDeVersaoError';
  }
}

/** Tentativa de criar um documento que já existe (ex.: elo da trilha já gravado). */
export class DocumentoJaExisteError extends Error {
  constructor(readonly path: string) {
    super(`Documento já existe em ${path}`);
    this.name = 'DocumentoJaExisteError';
  }
}

/** A operação não terminou dentro do prazo configurado. */
class PrazoEsgotadoError extends Error {
  readonly code = 'prazo-esgotado';
  constructor(ms: number) {
    super(`Operação no Firestore excedeu ${ms} ms`);
    this.name = 'PrazoEsgotadoError';
  }
}

/** Resultado de uma operação: `remoto: false` significa "emulador fora, use o store local". */
type Resultado<T> = { remoto: true; valor: T } | { remoto: false };

/** Código gRPC devolvido pelo Firestore quando `create()` encontra o documento já gravado. */
const GRPC_ALREADY_EXISTS = 6;

/** Documento lido por `/readyz` em produção. Fica fora de `/tenants` e não precisa existir. */
const DOCUMENTO_DE_SONDA = '_health/readyz';

const PRAZO_PRODUCAO_MS = 10_000;
const PRAZO_EMULADOR_MS = 5_000;
const PRAZO_SONDA_EMULADOR_MS = 1_000;
/** Por quanto tempo o resultado da sonda do emulador é reaproveitado. */
const VALIDADE_SONDA_EMULADOR_MS = 10_000;
/** Por quanto tempo um `/readyz` saudável é reaproveitado em produção (economia de cota — FinOps). */
const VALIDADE_READYZ_PADRAO_MS = 60_000;

/** Sondas de conectividade do emulador, por endereço, compartilhadas entre instâncias do serviço. */
const sondasDoEmulador = new Map<string, { expiraEm: number; resultado: Promise<boolean> }>();

function enderecoDoEmulador(): string {
  return (process.env['FIRESTORE_EMULATOR_HOST'] || 'localhost:8080').replace(/^https?:\/\//, '');
}

/**
 * Testa, com uma conexão TCP curta, se o emulador do Firestore está escutando.
 * Evita que o Admin SDK fique tentando reconectar (e travando a requisição) quando o emulador não
 * está rodando — caso comum nos testes unitários e ao subir só a API.
 */
function emuladorAcessivel(ignorarCache = false): Promise<boolean> {
  const endereco = enderecoDoEmulador();
  const emCache = sondasDoEmulador.get(endereco);
  if (!ignorarCache && emCache && emCache.expiraEm > Date.now()) {
    return emCache.resultado;
  }

  const separador = endereco.lastIndexOf(':');
  const host = separador > 0 ? endereco.slice(0, separador).replace(/^\[|\]$/g, '') : endereco;
  const porta = separador > 0 ? Number(endereco.slice(separador + 1)) : 8080;

  const resultado = new Promise<boolean>((resolver) => {
    const socket = connect({ host, port: porta });
    const encerrar = (acessivel: boolean): void => {
      socket.destroy();
      resolver(acessivel);
    };
    socket.setTimeout(PRAZO_SONDA_EMULADOR_MS);
    socket.once('connect', () => encerrar(true));
    socket.once('timeout', () => encerrar(false));
    socket.once('error', () => encerrar(false));
  });
  sondasDoEmulador.set(endereco, { expiraEm: Date.now() + VALIDADE_SONDA_EMULADOR_MS, resultado });
  return resultado;
}

function marcarEmuladorIndisponivel(): void {
  sondasDoEmulador.set(enderecoDoEmulador(), {
    expiraEm: Date.now() + VALIDADE_SONDA_EMULADOR_MS,
    resultado: Promise.resolve(false),
  });
}

/** Rejeita com `PrazoEsgotadoError` se a promessa não resolver em `ms`. */
function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const prazo = new Promise<never>((_resolver, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new PrazoEsgotadoError(ms)), ms);
  });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(temporizador));
}

/**
 * Converte o registro em dados aceitos pelo Firestore: remove campos `undefined` (o Admin SDK os
 * recusa), transforma datas em texto ISO e descarta qualquer coisa que não seja JSON.
 */
function paraFirestore(registro: object): FirebaseFirestore.DocumentData {
  return JSON.parse(JSON.stringify(registro)) as FirebaseFirestore.DocumentData;
}

function codigoDoErro(erro: unknown): string {
  const codigo = (erro as { code?: unknown } | null)?.code;
  if (typeof codigo === 'string' || typeof codigo === 'number') {
    return String(codigo);
  }
  return erro instanceof Error ? erro.name : 'erro-desconhecido';
}

/**
 * Persistência no Cloud Firestore via Firebase Admin SDK (ADR-004 / ADR-011 / RNF07 / RNF10 — Issue #29).
 *
 * Todo documento é lido e gravado dentro do caminho isolado do tenant:
 * `/tenants/{tenantId}/{subcoleção}/{docId}`.
 *
 * Comportamento por ambiente:
 *
 * | Ambiente              | Banco                         | Banco indisponível                        |
 * | --------------------- | ----------------------------- | ----------------------------------------- |
 * | `NODE_ENV=production` | Firestore real (Admin SDK)    | HTTP 503 — nada é guardado em memória     |
 * | demais                | Emulador (`FIRESTORE_EMULATOR_HOST`) | store em memória, só para desenvolver/testar |
 *
 * Em produção o fallback em memória não existe de propósito: o serviço hiberna e reinicia, então
 * "salvar" em memória esconderia a falha e perderia o dado em silêncio. Falhou, responde 5xx.
 *
 * @example
 * await firestore.setTenantDocument('startop', 'cost_centers', 'cc-101', { code: 'CC-101', name: 'Finanças' });
 * const centro = await firestore.getTenantDocument<CostCenter>('startop', 'cost_centers', 'cc-101');
 * const todos = await firestore.listTenantCollection<CostCenter>('startop', 'cost_centers');
 */
@Injectable()
export class FirestoreService {
  private readonly logger = new Logger(FirestoreService.name);

  /** Store local usado SOMENTE fora de produção, quando o emulador não está rodando. */
  private readonly memoryStore = new Map<string, Record<string, unknown>>();

  /** Momento do último `/readyz` saudável em produção (0 = precisa consultar o banco de novo). */
  private ultimoPingSaudavel = 0;

  /**
   * Salva (substituindo) um documento no escopo estrito do tenant:
   * `/tenants/{tenantId}/{subcollection}/{docId}`. O campo `tenantId` é sempre gravado junto.
   */
  async setTenantDocument<T extends object>(
    tenantId: string,
    subcollection: string,
    docId: string,
    data: T,
  ): Promise<T> {
    const relativePath = this.buildPath(tenantId, subcollection, docId);
    const record = { ...(data as Record<string, unknown>), tenantId };

    if (!this.emProducao()) {
      this.memoryStore.set(relativePath, record);
    }

    const resultado = await this.noBanco(`set ${relativePath}`, (db) =>
      db.doc(relativePath).set(paraFirestore(record)),
    );
    if (!resultado.remoto) {
      this.logger.debug(`Emulador do Firestore indisponível; documento mantido no store local (${relativePath}).`);
    }

    return record as T;
  }

  /**
   * Obtém um documento do tenant: `/tenants/{tenantId}/{subcollectionPath}/{docId}`.
   * Devolve `null` quando o documento não existe.
   */
  async getTenantDocument<T>(
    tenantId: string,
    subcollectionPath: string,
    docId: string,
  ): Promise<T | null> {
    const relativePath = this.buildPath(tenantId, subcollectionPath, docId);

    const resultado = await this.noBanco(`get ${relativePath}`, async (db) => {
      const snapshot = await db.doc(relativePath).get();
      return snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
    });

    if (this.emProducao()) {
      return resultado.remoto ? (resultado.valor as T | null) : null;
    }
    if (resultado.remoto && resultado.valor) {
      this.memoryStore.set(relativePath, resultado.valor);
      return resultado.valor as T;
    }
    return (this.memoryStore.get(relativePath) as T) ?? null;
  }

  /**
   * Lista os documentos de uma (sub)coleção do tenant: `/tenants/{tenantId}/{subcollectionPath}`.
   * Documentos gravados com `tenantId` diferente do solicitado são descartados (RNF07).
   */
  async listTenantCollection<T>(
    tenantId: string,
    subcollectionPath: string,
  ): Promise<T[]> {
    this.assertValidTenant(tenantId);
    const collectionPrefix = `tenants/${tenantId}/${this.limparCaminho(subcollectionPath)}`;

    const resultado = await this.noBanco(`list ${collectionPrefix}`, async (db) => {
      const snapshot = await db.collection(collectionPrefix).get();
      return snapshot.docs.map((doc) => ({ id: doc.id, dados: doc.data() as Record<string, unknown> }));
    });

    if (resultado.remoto) {
      const doTenant = resultado.valor.filter(
        ({ dados }) => !dados['tenantId'] || dados['tenantId'] === tenantId,
      );
      if (this.emProducao()) {
        return doTenant.map(({ dados }) => dados as T);
      }
      for (const { id, dados } of doTenant) {
        this.memoryStore.set(`${collectionPrefix}/${id}`, dados);
      }
      if (doTenant.length > 0) {
        return doTenant.map(({ dados }) => dados as T);
      }
    }

    // Só fora de produção: emulador fora do ar (ou coleção ainda vazia nele) → store local.
    const results: T[] = [];
    const prefixWithSlash = `${collectionPrefix}/`;
    for (const [key, value] of this.memoryStore.entries()) {
      if (key.startsWith(prefixWithSlash)) {
        const remainder = key.slice(prefixWithSlash.length);
        if (!remainder.includes('/') && (!value['tenantId'] || value['tenantId'] === tenantId)) {
          results.push(value as T);
        }
      }
    }
    return results;
  }

  /**
   * Atualiza um documento somente se ele não mudou desde a leitura (concorrência otimista — ADR-005).
   *
   * Leitura e escrita acontecem na mesma transação do Firestore: se o campo `versao` gravado for
   * diferente de `versaoEsperada` (outra decisão chegou antes), lança `ConflitoDeVersaoError`
   * (→ HTTP 409) e nada é gravado.
   */
  async updateTenantDocumentIfVersion<T extends { versao: number }>(
    tenantId: string,
    subcollectionPath: string,
    docId: string,
    versaoEsperada: number,
    data: T,
  ): Promise<T> {
    const relativePath = this.buildPath(tenantId, subcollectionPath, docId);
    const record = { ...(data as Record<string, unknown>), tenantId } as T & { tenantId: string };
    const producao = this.emProducao();

    const resultado = await this.noBanco(`update ${relativePath}`, (db) =>
      db.runTransaction(async (transacao) => {
        const referencia = db.doc(relativePath);
        const atual = await transacao.get(referencia);
        if (!atual.exists) {
          // No emulador o documento pode existir só no store local: quem decide é o fallback abaixo.
          if (!producao) return false;
        } else if (Number(atual.get('versao') ?? 1) !== versaoEsperada) {
          throw new ConflitoDeVersaoError(relativePath);
        }
        transacao.set(referencia, paraFirestore(record));
        return true;
      }),
    );

    if (producao) {
      return record;
    }
    if (resultado.remoto && resultado.valor) {
      this.memoryStore.set(relativePath, record);
      return record;
    }

    // Fallback em memória: verificação e escrita são síncronas, portanto atômicas no processo.
    const local = this.memoryStore.get(relativePath);
    if (local && Number(local['versao'] ?? 1) !== versaoEsperada) {
      throw new ConflitoDeVersaoError(relativePath);
    }
    this.memoryStore.set(relativePath, record);
    return record;
  }

  /**
   * Cria um documento apenas se ele ainda não existir (`create()` do Firestore).
   * Usado pela trilha de auditoria para que nenhum elo seja sobrescrito (imutabilidade — ADR-006).
   * Lança `DocumentoJaExisteError` quando o caminho já está ocupado.
   */
  async createTenantDocumentIfAbsent<T extends object>(
    tenantId: string,
    subcollectionPath: string,
    docId: string,
    data: T,
  ): Promise<T> {
    const relativePath = this.buildPath(tenantId, subcollectionPath, docId);
    const record = { ...(data as Record<string, unknown>), tenantId } as T;
    const reserva = record as Record<string, unknown>;
    const producao = this.emProducao();

    if (!producao) {
      if (this.memoryStore.has(relativePath)) {
        throw new DocumentoJaExisteError(relativePath);
      }
      // Reserva síncrona antes de qualquer await: duas criações simultâneas no mesmo processo
      // não conseguem ocupar o mesmo caminho.
      this.memoryStore.set(relativePath, reserva);
    }

    try {
      const resultado = await this.noBanco(`create ${relativePath}`, async (db) => {
        try {
          await db.doc(relativePath).create(paraFirestore(reserva));
        } catch (erro) {
          if ((erro as { code?: unknown } | null)?.code === GRPC_ALREADY_EXISTS) {
            throw new DocumentoJaExisteError(relativePath);
          }
          throw erro;
        }
      });
      if (!resultado.remoto) {
        this.logger.debug(`Emulador do Firestore indisponível; elo mantido no store local (${relativePath}).`);
      }
    } catch (erro) {
      if (erro instanceof DocumentoJaExisteError && this.memoryStore.get(relativePath) === reserva) {
        this.memoryStore.delete(relativePath);
      }
      throw erro;
    }

    return record;
  }

  /**
   * Verifica se o banco responde. Usado por `/api/readyz`.
   *
   * - Produção: lê um único documento do Firestore real (1 leitura). O resultado saudável é
   *   reaproveitado por `READYZ_CACHE_TTL_MS` (padrão 60 s), então monitores batendo em `/readyz`
   *   custam no máximo ~1.440 leituras/dia das 50.000 do plano Spark. Falhas não são cacheadas, e
   *   qualquer operação que falhe invalida o cache — a volta e a queda do banco aparecem na hora.
   * - Fora de produção: testa a porta do emulador, sem leitura alguma.
   */
  async ping(): Promise<boolean> {
    if (!this.emProducao()) {
      return emuladorAcessivel(true);
    }

    const validade = Number(process.env['READYZ_CACHE_TTL_MS'] ?? VALIDADE_READYZ_PADRAO_MS);
    if (this.ultimoPingSaudavel > 0 && Date.now() - this.ultimoPingSaudavel < validade) {
      return true;
    }

    try {
      await comPrazo(this.db().doc(DOCUMENTO_DE_SONDA).get(), PRAZO_PRODUCAO_MS);
      this.ultimoPingSaudavel = Date.now();
      return true;
    } catch (erro) {
      this.ultimoPingSaudavel = 0;
      this.logger.error(`Firestore indisponível no /readyz (${codigoDoErro(erro)}).`);
      return false;
    }
  }

  /**
   * Executa uma operação no Firestore aplicando a política de falha do ambiente:
   * produção → HTTP 503; demais → sinaliza `remoto: false` para o chamador usar o store local.
   * Erros de domínio (`ConflitoDeVersaoError`, `DocumentoJaExisteError`) sempre passam direto.
   */
  private async noBanco<T>(
    descricao: string,
    operacao: (db: Firestore) => Promise<T>,
  ): Promise<Resultado<T>> {
    if (this.emProducao()) {
      try {
        return { remoto: true, valor: await comPrazo(operacao(this.db()), PRAZO_PRODUCAO_MS) };
      } catch (erro) {
        if (erro instanceof ConflitoDeVersaoError || erro instanceof DocumentoJaExisteError) {
          throw erro;
        }
        this.ultimoPingSaudavel = 0;
        // Registra só a operação, o caminho e o código do erro — nunca o conteúdo do documento.
        this.logger.error(`Firestore indisponível em "${descricao}" (${codigoDoErro(erro)}).`);
        throw new ServiceUnavailableException({
          error: 'FIRESTORE_INDISPONIVEL',
          message: 'Firestore indisponível.',
        });
      }
    }

    if (!(await emuladorAcessivel())) {
      return { remoto: false };
    }
    try {
      return { remoto: true, valor: await comPrazo(operacao(this.db()), PRAZO_EMULADOR_MS) };
    } catch (erro) {
      if (erro instanceof ConflitoDeVersaoError || erro instanceof DocumentoJaExisteError) {
        throw erro;
      }
      marcarEmuladorIndisponivel();
      this.logger.debug(`Emulador do Firestore falhou em "${descricao}" (${codigoDoErro(erro)}); usando store local.`);
      return { remoto: false };
    }
  }

  /** Instância do Firestore do Admin SDK. Obtida sob demanda para o boot não depender do banco. */
  private db(): Firestore {
    return getFirestore(getFirebaseApp());
  }

  private emProducao(): boolean {
    return process.env['NODE_ENV'] === 'production';
  }

  private limparCaminho(subcollectionPath: string): string {
    return subcollectionPath.replace(/^\/+|\/+$/g, '');
  }

  private buildPath(tenantId: string, subcollectionPath: string, docId: string): string {
    this.assertValidTenant(tenantId);
    this.assertValidDocId(docId);
    return `tenants/${tenantId}/${this.limparCaminho(subcollectionPath)}/${docId}`;
  }

  private assertValidTenant(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new Error('Violação Multi-tenant (RNF07): tenantId é obrigatório em toda operação.');
    }
    if (tenantId.includes('/') || tenantId === '.' || tenantId === '..') {
      throw new Error('Violação Multi-tenant (RNF07): tenantId não pode conter separador de caminho.');
    }
  }

  /**
   * O id vira um segmento do caminho do documento: se contivesse `/`, apontaria para outra
   * coleção. Ids vindos do cliente passam por aqui, por isso a recusa é um 400.
   */
  private assertValidDocId(docId: string): void {
    const invalido =
      typeof docId !== 'string' ||
      docId.length === 0 ||
      docId.includes('/') ||
      docId === '.' ||
      docId === '..' ||
      /^__.*__$/.test(docId);
    if (invalido) {
      throw new BadRequestException('Identificador de documento inválido.');
    }
  }
}
