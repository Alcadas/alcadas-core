import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
}

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

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

/**
 * Serviço de persistência conectado ao Emulador do Google Cloud Firestore (ADR-004 / RNF07 / RNF10).
 * Grava e lê documentos sempre dentro do caminho isolado do tenant: /tenants/{tenantId}/{subcollectionPath}/{docId}.
 */
@Injectable()
export class FirestoreService {
  private readonly logger = new Logger(FirestoreService.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  // Store em memória sincronizado como fallback quando o emulador não está rodando localmente
  private readonly memoryStore = new Map<string, Record<string, unknown>>();

  constructor() {
    const emulatorHost = process.env['FIRESTORE_EMULATOR_HOST'] || 'localhost:8080';
    const projectId = process.env['FIREBASE_PROJECT_ID'] || 'demo-alcadas';
    const hostWithProtocol = emulatorHost.startsWith('http')
      ? emulatorHost
      : `http://${emulatorHost}`;

    this.baseUrl = `${hostWithProtocol}/v1/projects/${projectId}/databases/(default)/documents`;
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 2500,
      headers: {
        Authorization: 'Bearer owner',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Salva ou atualiza um documento dentro do escopo estrito do tenant:
   * /tenants/{tenantId}/{subcollectionPath}/{docId}
   */
  async setTenantDocument<T extends object>(
    tenantId: string,
    subcollectionPath: string,
    docId: string,
    data: T,
  ): Promise<T> {
    this.assertValidTenant(tenantId);
    const cleanSubPath = subcollectionPath.replace(/^\/+|\/+$/g, '');
    const relativePath = `tenants/${encodeURIComponent(tenantId)}/${cleanSubPath}/${encodeURIComponent(docId)}`;
    const record = { ...(data as Record<string, unknown>), tenantId };

    this.memoryStore.set(relativePath, record);

    try {
      const firestoreFields = this.toFirestoreFields(record);
      await this.http.patch(`/${relativePath}`, { fields: firestoreFields });
    } catch {
      this.logger.debug(
        `Firestore Emulator indisponível em ${this.baseUrl}; documento persistido no store local (${relativePath}).`,
      );
    }

    return record as T;
  }

  /**
   * Obtém um documento específico dentro do escopo do tenant:
   * /tenants/{tenantId}/{subcollectionPath}/{docId}
   */
  async getTenantDocument<T>(
    tenantId: string,
    subcollectionPath: string,
    docId: string,
  ): Promise<T | null> {
    this.assertValidTenant(tenantId);
    const cleanSubPath = subcollectionPath.replace(/^\/+|\/+$/g, '');
    const relativePath = `tenants/${encodeURIComponent(tenantId)}/${cleanSubPath}/${encodeURIComponent(docId)}`;

    try {
      const response = await this.http.get<FirestoreDocument>(`/${relativePath}`);
      if (response.data && response.data.fields) {
        const parsed = this.fromFirestoreFields(response.data.fields);
        this.memoryStore.set(relativePath, parsed);
        return parsed as T;
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return (this.memoryStore.get(relativePath) as T) ?? null;
      }
    }

    const fallback = this.memoryStore.get(relativePath);
    return (fallback as T) ?? null;
  }

  /**
   * Lista todos os documentos de uma coleção ou subcoleção pertencentes ao tenant informado:
   * /tenants/{tenantId}/{subcollectionPath}
   */
  async listTenantCollection<T>(
    tenantId: string,
    subcollectionPath: string,
  ): Promise<T[]> {
    this.assertValidTenant(tenantId);
    const cleanSubPath = subcollectionPath.replace(/^\/+|\/+$/g, '');
    const collectionPrefix = `tenants/${encodeURIComponent(tenantId)}/${cleanSubPath}`;

    try {
      const response = await this.http.get<{ documents?: FirestoreDocument[] }>(
        `/${collectionPrefix}`,
      );
      const docs = response.data?.documents ?? [];
      const results: T[] = [];

      for (const doc of docs) {
        if (doc.fields) {
          const parsed = this.fromFirestoreFields(doc.fields);
          if (!parsed['tenantId'] || parsed['tenantId'] === tenantId) {
            const docId = doc.name?.split('/').pop();
            if (docId) {
              this.memoryStore.set(`${collectionPrefix}/${docId}`, parsed);
            }
            results.push(parsed as T);
          }
        }
      }
      if (results.length > 0) {
        return results;
      }
    } catch {
      // Fallback para o store em memória quando o emulador não estiver rodando
    }

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
   * A condição é dupla: o campo `versao` gravado precisa ser igual a `versaoEsperada` e, no emulador,
   * o PATCH usa a precondição nativa `currentDocument.updateTime`. Se outra decisão gravou antes,
   * o Firestore responde FAILED_PRECONDITION e lançamos `ConflitoDeVersaoError` (→ HTTP 409).
   */
  async updateTenantDocumentIfVersion<T extends { versao: number }>(
    tenantId: string,
    subcollectionPath: string,
    docId: string,
    versaoEsperada: number,
    data: T,
  ): Promise<T> {
    this.assertValidTenant(tenantId);
    const relativePath = this.buildPath(tenantId, subcollectionPath, docId);
    const record = { ...(data as Record<string, unknown>), tenantId } as T & { tenantId: string };

    let remote: { updateTime?: string; fields?: Record<string, FirestoreValue> } | null = null;
    try {
      const response = await this.http.get<FirestoreDocument & { updateTime?: string }>(
        `/${relativePath}`,
      );
      remote = response.data;
    } catch (error: unknown) {
      if (!(axios.isAxiosError(error) && error.response?.status === 404)) {
        remote = null; // emulador indisponível → segue apenas com o store em memória
      }
    }

    if (remote?.fields) {
      const atual = this.fromFirestoreFields(remote.fields);
      if (Number(atual['versao'] ?? 1) !== versaoEsperada) {
        throw new ConflitoDeVersaoError(relativePath);
      }
      try {
        await this.http.patch(`/${relativePath}`, { fields: this.toFirestoreFields(record) }, {
          params: { 'currentDocument.updateTime': remote.updateTime },
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && [400, 409, 412].includes(error.response?.status ?? 0)) {
          throw new ConflitoDeVersaoError(relativePath);
        }
        throw error;
      }
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
   * Cria um documento apenas se ele ainda não existir (precondição `currentDocument.exists=false`).
   * Usado pela trilha de auditoria para que nenhum elo seja sobrescrito (imutabilidade — ADR-006).
   */
  async createTenantDocumentIfAbsent<T extends object>(
    tenantId: string,
    subcollectionPath: string,
    docId: string,
    data: T,
  ): Promise<T> {
    this.assertValidTenant(tenantId);
    const relativePath = this.buildPath(tenantId, subcollectionPath, docId);
    const record = { ...(data as Record<string, unknown>), tenantId } as T;

    if (this.memoryStore.has(relativePath)) {
      throw new DocumentoJaExisteError(relativePath);
    }
    // Reserva síncrona antes de qualquer await: duas criações simultâneas no mesmo processo
    // não conseguem ocupar o mesmo caminho.
    const reserva = record as Record<string, unknown>;
    this.memoryStore.set(relativePath, reserva);

    try {
      await this.http.patch(`/${relativePath}`, { fields: this.toFirestoreFields(reserva) }, {
        params: { 'currentDocument.exists': false },
      });
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response && [400, 409, 412].includes(error.response.status)) {
        if (this.memoryStore.get(relativePath) === reserva) {
          this.memoryStore.delete(relativePath);
        }
        throw new DocumentoJaExisteError(relativePath);
      }
      this.logger.debug(`Firestore Emulator indisponível; elo mantido no store local (${relativePath}).`);
    }

    return record;
  }

  /**
   * Verifica se o Firestore (emulador) responde. Usado por `/readyz`.
   */
  async ping(): Promise<boolean> {
    try {
      await this.http.get('/', { timeout: 1000, validateStatus: (s) => s < 500 });
      return true;
    } catch {
      return false;
    }
  }

  private buildPath(tenantId: string, subcollectionPath: string, docId: string): string {
    const cleanSubPath = subcollectionPath.replace(/^\/+|\/+$/g, '');
    return `tenants/${encodeURIComponent(tenantId)}/${cleanSubPath}/${encodeURIComponent(docId)}`;
  }

  private assertValidTenant(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new Error('Violação Multi-tenant (RNF07): tenantId é obrigatório em toda operação.');
    }
  }

  private toFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        fields[key] = this.toFirestoreValue(value);
      }
    }
    return fields;
  }

  private toFirestoreValue(value: unknown): FirestoreValue {
    if (value === null || value === undefined) {
      return { nullValue: null };
    }
    if (typeof value === 'string') {
      return { stringValue: value };
    }
    if (typeof value === 'boolean') {
      return { booleanValue: value };
    }
    if (typeof value === 'number') {
      return { doubleValue: value };
    }
    if (Array.isArray(value)) {
      return {
        arrayValue: {
          values: value.map((item) => this.toFirestoreValue(item)),
        },
      };
    }
    if (typeof value === 'object') {
      return {
        mapValue: {
          fields: this.toFirestoreFields(value as Record<string, unknown>),
        },
      };
    }
    return { stringValue: String(value) };
  }

  private fromFirestoreFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(fields)) {
      result[key] = this.fromFirestoreValue(val);
    }
    return result;
  }

  private fromFirestoreValue(val: FirestoreValue): unknown {
    if ('nullValue' in val) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.doubleValue !== undefined) return Number(val.doubleValue);
    if (val.integerValue !== undefined) return Number(val.integerValue);
    if (val.arrayValue) {
      return (val.arrayValue.values ?? []).map((item) => this.fromFirestoreValue(item));
    }
    if (val.mapValue) {
      return this.fromFirestoreFields(val.mapValue.fields ?? {});
    }
    return null;
  }
}
