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

/**
 * Serviço de persistência conectado ao Emulador do Google Cloud Firestore (ADR-004 / RNF07 / RNF10).
 * Grava e lê documentos sempre dentro do caminho isolado do tenant: /tenants/{tenantId}/{collection}/{docId}.
 */
@Injectable()
export class FirestoreService {
  private readonly logger = new Logger(FirestoreService.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  // Store em memória sincronizado que atua como fallback caso o emulador não esteja rodando no host local
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
   * /tenants/{tenantId}/{subcollection}/{docId}
   */
  async setTenantDocument<T extends object>(
    tenantId: string,
    subcollection: string,
    docId: string,
    data: T,
  ): Promise<T> {
    this.assertValidTenant(tenantId);
    const relativePath = `tenants/${encodeURIComponent(tenantId)}/${subcollection}/${encodeURIComponent(docId)}`;
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
   * /tenants/{tenantId}/{subcollection}/{docId}
   */
  async getTenantDocument<T>(
    tenantId: string,
    subcollection: string,
    docId: string,
  ): Promise<T | null> {
    this.assertValidTenant(tenantId);
    const relativePath = `tenants/${encodeURIComponent(tenantId)}/${subcollection}/${encodeURIComponent(docId)}`;

    try {
      const response = await this.http.get<FirestoreDocument>(`/${relativePath}`);
      if (response.data && response.data.fields) {
        const parsed = this.fromFirestoreFields(response.data.fields);
        this.memoryStore.set(relativePath, parsed);
        return parsed as T;
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
    }

    const fallback = this.memoryStore.get(relativePath);
    return (fallback as T) ?? null;
  }

  /**
   * Lista todos os documentos de uma subcoleção pertencentes exclusivamente ao tenant informado:
   * /tenants/{tenantId}/{subcollection}
   */
  async listTenantCollection<T>(tenantId: string, subcollection: string): Promise<T[]> {
    this.assertValidTenant(tenantId);
    const collectionPrefix = `tenants/${encodeURIComponent(tenantId)}/${subcollection}`;

    try {
      const response = await this.http.get<{ documents?: FirestoreDocument[] }>(
        `/${collectionPrefix}`,
      );
      const docs = response.data?.documents ?? [];
      const results: T[] = [];

      for (const doc of docs) {
        if (doc.fields) {
          const parsed = this.fromFirestoreFields(doc.fields);
          if (parsed['tenantId'] === tenantId) {
            const docId = doc.name?.split('/').pop();
            if (docId) {
              this.memoryStore.set(`${collectionPrefix}/${docId}`, parsed);
            }
            results.push(parsed as T);
          }
        }
      }
      return results;
    } catch {
      // Fallback para o store local filtrando estritamente pelo prefixo do tenant e propriedade tenantId
      const results: T[] = [];
      const prefixWithSlash = `${collectionPrefix}/`;
      for (const [key, value] of this.memoryStore.entries()) {
        if (key.startsWith(prefixWithSlash) && value['tenantId'] === tenantId) {
          results.push(value as T);
        }
      }
      return results;
    }
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
      if (Number.isInteger(value)) {
        return { doubleValue: value };
      }
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
