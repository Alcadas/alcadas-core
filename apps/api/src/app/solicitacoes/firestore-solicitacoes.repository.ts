import { Injectable } from '@nestjs/common';
import { getFirebaseApp } from '../firebase/firebase-app';
import { getFirestore } from 'firebase-admin/firestore';
import { FiltroListagem, ISolicitacoesRepository } from './solicitacoes.repository';

@Injectable()
export class FirestoreSolicitacoesRepository implements ISolicitacoesRepository {
  async salvarComTrilha(solicitacao: Record<string, unknown>, eloTrilha: Record<string, unknown>): Promise<void> {
    const db = getFirestore(getFirebaseApp());
    const batch = db.batch();

    const solicitacaoRef = db
      .collection('tenants').doc(solicitacao['tenantId'] as string)
      .collection('requests').doc(solicitacao['id'] as string);
      
    const auditRef = solicitacaoRef
      .collection('audit_blocks').doc(String(eloTrilha['sequencia']));

    batch.set(solicitacaoRef, solicitacao as FirebaseFirestore.DocumentData);
    batch.set(auditRef, eloTrilha as FirebaseFirestore.DocumentData);

    await batch.commit();
  }

  /**
   * Página de solicitações do tenant, da mais recente para a mais antiga.
   * Filtrar por status junto com a ordenação exige o índice composto (status, createdAt desc)
   * em produção; o emulador não exige índices.
   */
  async listarPorTenant(tenantId: string, filtro: FiltroListagem): Promise<Record<string, unknown>[]> {
    const db = getFirestore(getFirebaseApp());
    let consulta = db.collection('tenants').doc(tenantId).collection('requests').orderBy('createdAt', 'desc');
    if (filtro.status) {
      consulta = consulta.where('status', '==', filtro.status);
    }
    const snapshot = await consulta
      .offset((filtro.page - 1) * filtro.limit)
      .limit(filtro.limit)
      .get();

    return snapshot.empty ? [] : (snapshot.docs.map(doc => doc.data()) as Record<string, unknown>[]);
  }
}