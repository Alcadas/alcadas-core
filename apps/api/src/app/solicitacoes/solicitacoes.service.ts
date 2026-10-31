import { Injectable, BadRequestException } from '@nestjs/common';
import { FirebaseApp } from '../firebase/firebase-app';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SolicitacoesService {
  constructor(private readonly firebaseApp: FirebaseApp) {}

  async criarSolicitacao(dto: CriarSolicitacaoDto, tenantId: string, solicitanteId: string) {
       const LIMITE_BASE_CATEGORIA = 1000.00; 
    
    if (dto.valor > LIMITE_BASE_CATEGORIA) {
      if (!dto.justificativa || dto.justificativa.length < 30) {
        throw new BadRequestException('Para valores acima da base da categoria, a justificativa deve conter no mínimo 30 caracteres.');
      }
    }

    const db = this.firebaseApp.firestore();
    const batch = db.batch();
    const solicitacaoId = `sol-${uuidv4().substring(0, 8)}`; 
    
    const solicitacaoRef = db.collection('tenants').doc(tenantId).collection('requests').doc(solicitacaoId);
    const auditRef = solicitacaoRef.collection('audit_blocks').doc('0');

    const agora = new Date().toISOString();

    const solicitacaoData = {
      id: solicitacaoId,
      tenantId,
      centroCustoId: dto.centroCustoId,
      solicitanteId,
      valor: dto.valor,
      categoria: dto.categoria,
      justificativa: dto.justificativa || '',
      fornecedor: dto.fornecedor || null,
      status: 'PENDENTE',
      versao: 1,
      createdAt: agora,
      updatedAt: agora,
    };

    const hashAnterior = '0000000000000000000000000000000000000000000000000000000000000000';
    const canonicalPayload = JSON.stringify({
      centroCustoId: dto.centroCustoId,
      valor: dto.valor,
      categoria: dto.categoria
    });
    
    const stringParaHash = `${hashAnterior}${agora}${solicitanteId}${canonicalPayload}`;
    const hashAtual = crypto.createHash('sha256').update(stringParaHash).digest('hex');

    const auditData = {
      sequencia: 0,
      hashAnterior,
      hashAtual,
      action: 'CRIACAO_SOLICITACAO',
      authorId: solicitanteId,
      timestampUtc: agora,
      canonicalPayload: {
        centroCustoId: dto.centroCustoId,
        valor: dto.valor,
        categoria: dto.categoria
      }
    };

    batch.set(solicitacaoRef, solicitacaoData);
    batch.set(auditRef, auditData);
    await batch.commit();

    return solicitacaoData;
  }

  async listarPorTenant(tenantId: string) {
    const db = this.firebaseApp.firestore();
    const snapshot = await db.collection('tenants').doc(tenantId).collection('requests')
                             .orderBy('createdAt', 'desc')
                             .limit(20)
                             .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => doc.data());
  }
}