import { Injectable } from '@nestjs/common';
import { getFirebaseApp } from '../firebase/firebase-app';
import { getFirestore } from 'firebase-admin/firestore';
import { ISolicitacoesRepository } from './solicitacoes.repository';

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

  async listarPorTenant(tenantId: string): Promise<Record<string, unknown>[]> {
    const db = getFirestore(getFirebaseApp());
    const snapshot = await db
      .collection('tenants').doc(tenantId)
      .collection('requests')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return snapshot.empty ? [] : (snapshot.docs.map(doc => doc.data()) as Record<string, unknown>[]);
  }
}