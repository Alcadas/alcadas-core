import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreService } from '../database/firestore.service';
import { getFirebaseApp } from '../firebase/firebase-app';
import { FiltroListagem, ISolicitacoesRepository } from './solicitacoes.repository';

/** Em produção não há fallback em memória: falha de banco vira HTTP 503 (#29). */
function emProducao(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

/** Remove campos `undefined`, que o Admin SDK recusa ao gravar. */
function semIndefinidos(dados: Record<string, unknown>): FirebaseFirestore.DocumentData {
  return JSON.parse(JSON.stringify(dados)) as FirebaseFirestore.DocumentData;
}

function firestoreIndisponivel(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    error: 'FIRESTORE_INDISPONIVEL',
    message: 'Firestore indisponível.',
  });
}

/**
 * Repositório de solicitações no Firestore (`/tenants/{tenantId}/requests`).
 *
 * - Produção: grava solicitação + primeiro elo da trilha em um único lote atômico do Admin SDK
 *   (2 escritas) e propaga qualquer falha como 503.
 * - Demais ambientes: mantém também a cópia via `FirestoreService`, que cobre o emulador desligado.
 */
@Injectable()
export class FirestoreSolicitacoesRepository implements ISolicitacoesRepository {
  constructor(@Optional() private readonly firestoreService?: FirestoreService) {}

  async salvarComTrilha(solicitacao: Record<string, unknown>, eloTrilha: Record<string, unknown>): Promise<void> {
    const tenantId = solicitacao['tenantId'] as string;
    const solicitacaoId = solicitacao['id'] as string;
    const sequencia = String(eloTrilha['sequencia']);

    // Fora de produção a cópia via serviço alimenta o store local usado quando o emulador está fora.
    // Em produção ela seria só uma segunda gravação dos mesmos documentos (cota desperdiçada).
    if (this.firestoreService && !emProducao()) {
      await this.firestoreService.setTenantDocument(tenantId, 'requests', solicitacaoId, solicitacao);
      await this.firestoreService.setTenantDocument(
        tenantId,
        `requests/${solicitacaoId}/audit_blocks`,
        sequencia,
        eloTrilha,
      );
    }

    try {
      const db = getFirestore(getFirebaseApp());
      const batch = db.batch();

      const solicitacaoRef = db
        .collection('tenants').doc(tenantId)
        .collection('requests').doc(solicitacaoId);

      const auditRef = solicitacaoRef
        .collection('audit_blocks').doc(sequencia);

      batch.set(solicitacaoRef, semIndefinidos(solicitacao));
      batch.set(auditRef, semIndefinidos(eloTrilha));

      await batch.commit();
    } catch {
      if (emProducao()) {
        throw firestoreIndisponivel();
      }
      if (!this.firestoreService) {
        throw new Error('Firestore indisponível.');
      }
    }
  }

  /**
   * Página de solicitações do tenant, da mais recente para a mais antiga.
   * Filtrar por status junto com a ordenação exige o índice composto (status, createdAt desc)
   * em produção; o emulador não exige índices.
   */
  async listarPorTenant(tenantId: string, filtro: FiltroListagem): Promise<Record<string, unknown>[]> {
    try {
      const db = getFirestore(getFirebaseApp());
      let consulta: FirebaseFirestore.Query = db
        .collection('tenants')
        .doc(tenantId)
        .collection('requests')
        .orderBy('createdAt', 'desc');
      if (filtro.status) {
        consulta = consulta.where('status', '==', filtro.status);
      }
      const snapshot = await consulta
        .offset((filtro.page - 1) * filtro.limit)
        .limit(filtro.limit)
        .get();

      return snapshot.empty ? [] : (snapshot.docs.map((doc) => doc.data()) as Record<string, unknown>[]);
    } catch {
      // A consulta paginada pode falhar por índice composto ausente; a listagem via serviço lê a
      // mesma coleção do banco real e, em produção, responde 503 se o Firestore estiver fora.
      if (!this.firestoreService) {
        if (emProducao()) {
          throw firestoreIndisponivel();
        }
        return [];
      }
      const docs = await this.firestoreService.listTenantCollection<Record<string, unknown>>(
        tenantId,
        'requests',
      );
      const filtrados = filtro.status ? docs.filter((d) => d['status'] === filtro.status) : docs;
      return filtrados
        .sort((a, b) => String(b['createdAt'] ?? '').localeCompare(String(a['createdAt'] ?? '')))
        .slice((filtro.page - 1) * filtro.limit, filtro.page * filtro.limit);
    }
  }
}
