import { Injectable, Optional } from '@nestjs/common';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreService } from '../database/firestore.service';
import { getFirebaseApp } from '../firebase/firebase-app';
import { FiltroListagem, ISolicitacoesRepository } from './solicitacoes.repository';

@Injectable()
export class FirestoreSolicitacoesRepository implements ISolicitacoesRepository {
  constructor(@Optional() private readonly firestoreService?: FirestoreService) {}

  async salvarComTrilha(solicitacao: Record<string, unknown>, eloTrilha: Record<string, unknown>): Promise<void> {
    const tenantId = solicitacao['tenantId'] as string;
    const solicitacaoId = solicitacao['id'] as string;
    const sequencia = String(eloTrilha['sequencia']);

    if (this.firestoreService) {
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

      batch.set(solicitacaoRef, solicitacao as FirebaseFirestore.DocumentData);
      batch.set(auditRef, eloTrilha as FirebaseFirestore.DocumentData);

      await batch.commit();
    } catch {
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
      if (!this.firestoreService) {
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
