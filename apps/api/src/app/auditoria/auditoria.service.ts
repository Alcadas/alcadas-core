import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { EloAuditoriaDto, TipoEventoTrilha } from '@alcadas-core/models';
import { FirestoreService } from '../database/firestore.service';

/**
 * Hash Gênese fixo e documentado em 64 zeros hexadecimais (ADR-006 / CA-07.2).
 */
export const GENESIS_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

@Injectable()
export class AuditoriaService {
  constructor(private readonly firestore: FirestoreService) {}

  /**
   * Gera e persiste um novo elo imutável na trilha de auditoria da solicitação no Firestore Emulator:
   * /tenants/{tenantId}/requests/{requestId}/audit_blocks/{sequencia}
   *
   * Fórmula canônica (RN07 / ADR-006):
   * H_n = SHA-256(H_{n-1} || timestampUtc || authorId || tipoEvento || canonicalPayload)
   */
  async recordEvent(params: {
    tenantId: string;
    requestId: string;
    tipoEvento: TipoEventoTrilha;
    authorId: string;
    authorRole?: string;
    payload: Record<string, unknown>;
    timestampUtc?: string;
  }): Promise<EloAuditoriaDto> {
    const existingBlocks = await this.getAuditTrail(params.tenantId, params.requestId);
    const lastBlock =
      existingBlocks.length > 0 ? existingBlocks[existingBlocks.length - 1] : null;

    const sequencia = lastBlock ? lastBlock.sequencia + 1 : 1;
    const hashAnterior = lastBlock ? lastBlock.hashAtual : GENESIS_HASH;
    const timestampUtc = params.timestampUtc ?? new Date().toISOString();

    const hashAtual = this.computeSha256Hash({
      hashAnterior,
      timestampUtc,
      authorId: params.authorId,
      tipoEvento: params.tipoEvento,
      payload: params.payload,
    });

    const newBlock: EloAuditoriaDto = {
      sequencia,
      hashAtual,
      hashAnterior,
      tipoEvento: params.tipoEvento,
      authorId: params.authorId,
      ...(params.authorRole ? { authorRole: params.authorRole } : {}),
      timestampUtc,
      payload: params.payload,
    };

    const subcollectionPath = `requests/${params.requestId}/audit_blocks`;
    await this.firestore.setTenantDocument(
      params.tenantId,
      subcollectionPath,
      String(sequencia),
      newBlock,
    );

    return newBlock;
  }

  /**
   * Recupera todos os elos da trilha de auditoria de uma solicitação ordenados por sequência.
   */
  async getAuditTrail(tenantId: string, requestId: string): Promise<EloAuditoriaDto[]> {
    const subcollectionPath = `requests/${requestId}/audit_blocks`;
    const blocks = await this.firestore.listTenantCollection<EloAuditoriaDto>(
      tenantId,
      subcollectionPath,
    );
    return blocks.sort((a, b) => a.sequencia - b.sequencia);
  }

  /**
   * Calcula de forma determinística o hash SHA-256 com serialização JSON canônica (ADR-006).
   */
  computeSha256Hash(input: {
    hashAnterior: string;
    timestampUtc: string;
    authorId: string;
    tipoEvento: TipoEventoTrilha;
    payload: Record<string, unknown>;
  }): string {
    const canonicalPayload = this.canonicalStringify(input.payload);
    const rawData = `${input.hashAnterior}|${input.timestampUtc}|${input.authorId}|${input.tipoEvento}|${canonicalPayload}`;
    return createHash('sha256').update(rawData, 'utf8').digest('hex');
  }

  private canonicalStringify(value: unknown): string {
    if (value === null || value === undefined || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalStringify(item)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const entries = sortedKeys
      .filter((k) => record[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${this.canonicalStringify(record[k])}`);
    return `{${entries.join(',')}}`;
  }
}
