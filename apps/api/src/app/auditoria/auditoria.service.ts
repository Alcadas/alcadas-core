import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { EloAuditoriaDto, TipoEventoTrilha } from '@alcadas-core/models';
import { DocumentoJaExisteError, FirestoreService } from '../database/firestore.service';

const MAX_TENTATIVAS_ELO = 3;

export type MotivoInconsistencia = 'SEQUENCIA_QUEBRADA' | 'ENCADEAMENTO_QUEBRADO' | 'HASH_DIVERGENTE';

/**
 * Resultado da verificação da trilha — contrato `VerificacaoTrilhaResponseDto` do OpenAPI.
 */
export interface VerificacaoTrilhaResultado {
  status: 'INTEGRA' | 'INCONSISTENTE';
  totalElos: number;
  /** Sequência do primeiro elo divergente, ou null quando íntegra. */
  eloInconsistente: number | null;
  motivo: MotivoInconsistencia | null;
  mensagem: string;
  tempoProcessamentoMs: number;
}

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
    const subcollectionPath = `requests/${params.requestId}/audit_blocks`;

    // O elo é criado com precondição "não existe": se outro evento ocupou a mesma sequência
    // ao mesmo tempo, recalculamos sobre o novo último elo em vez de sobrescrever (ADR-006).
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_ELO; tentativa++) {
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

      try {
        await this.firestore.createTenantDocumentIfAbsent(
          params.tenantId,
          subcollectionPath,
          String(sequencia),
          newBlock,
        );
        return newBlock;
      } catch (error) {
        if (!(error instanceof DocumentoJaExisteError) || tentativa === MAX_TENTATIVAS_ELO) {
          throw error;
        }
      }
    }
    /* istanbul ignore next */
    throw new Error('Não foi possível registrar o elo da trilha de auditoria.');
  }

  /**
   * Recalcula a cadeia elo a elo e aponta o primeiro registro quebrado (US-08 / CA-08.2).
   *
   * Um elo é considerado inconsistente quando:
   * - a sequência não é contínua (elo removido ou inserido fora de ordem);
   * - `hashAnterior` não coincide com o `hashAtual` do elo anterior (ou com o gênese no 1º elo);
   * - o `hashAtual` gravado difere do recálculo SHA-256 dos dados do próprio elo (dado adulterado).
   */
  async verificarCadeia(tenantId: string, requestId: string): Promise<VerificacaoTrilhaResultado> {
    const inicio = performance.now();
    const elos = await this.getAuditTrail(tenantId, requestId);
    const resultado = this.verificarElos(elos);
    return {
      ...resultado,
      tempoProcessamentoMs: Number((performance.now() - inicio).toFixed(2)),
    };
  }

  /**
   * Verificação pura (sem I/O) — exposta para testes unitários.
   */
  verificarElos(elos: EloAuditoriaDto[]): Omit<VerificacaoTrilhaResultado, 'tempoProcessamentoMs'> {
    let hashEsperadoAnterior = GENESIS_HASH;

    for (let i = 0; i < elos.length; i++) {
      const elo = elos[i];
      let motivo: MotivoInconsistencia | null = null;

      if (elo.sequencia !== i + 1) {
        motivo = 'SEQUENCIA_QUEBRADA';
      } else if (elo.hashAnterior !== hashEsperadoAnterior) {
        motivo = 'ENCADEAMENTO_QUEBRADO';
      } else {
        const recalculado = this.computeSha256Hash({
          hashAnterior: elo.hashAnterior,
          timestampUtc: elo.timestampUtc,
          authorId: elo.authorId,
          tipoEvento: elo.tipoEvento,
          payload: elo.payload ?? {},
        });
        if (recalculado !== elo.hashAtual) {
          motivo = 'HASH_DIVERGENTE';
        }
      }

      if (motivo) {
        return {
          status: 'INCONSISTENTE',
          totalElos: elos.length,
          eloInconsistente: i + 1,
          motivo,
          mensagem: `Inconsistente / Adulterado: o elo ${i + 1} falhou na verificação (${motivo}).`,
        };
      }
      hashEsperadoAnterior = elo.hashAtual;
    }

    return {
      status: 'INTEGRA',
      totalElos: elos.length,
      eloInconsistente: null,
      motivo: null,
      mensagem: 'Todos os selos criptográficos SHA-256 coincidem deterministicamente.',
    };
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
