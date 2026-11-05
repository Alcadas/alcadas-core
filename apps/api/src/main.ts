import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { AlcadasService } from './app/alcadas/alcadas.service';
import { AppModule } from './app/app.module';
import { FiltroErrosHttp } from './app/common/filtro-erros-http';
import { FirestoreService } from './app/database/firestore.service';
import { getFirebaseApp } from './app/firebase/firebase-app';

async function seedDeveloperAccess(app: Awaited<ReturnType<typeof NestFactory.create>>): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    return;
  }

  try {
    const auth = getAuth(getFirebaseApp());
    const devUid = 'dev-master';
    const devEmail = 'dev@alcadas.com';
    const devClaims = {
      tenantId: 'startop',
      role: 'SUPER_USER',
      roles: ['SUPER_USER', 'ADMIN', 'DIRETOR_CFO', 'APROVADOR_N2', 'APROVADOR_N1', 'AUDITOR', 'SOLICITANTE'],
      name: 'Desenvolvedor',
    };

    try {
      await auth.getUser(devUid);
      await auth.updateUser(devUid, { displayName: 'Desenvolvedor' });
      await auth.setCustomUserClaims(devUid, devClaims);
    } catch {
      await auth.createUser({
        uid: devUid,
        email: devEmail,
        password: 'dev123456',
        displayName: 'Desenvolvedor',
        emailVerified: true,
      });
      await auth.setCustomUserClaims(devUid, devClaims);
    }
    Logger.log('🔑 Acesso Desenvolvedor garantido no Auth Emulator: dev@alcadas.com / dev123456');
  } catch {
    Logger.debug('Auth Emulator ainda indisponível para seed automático (fallback JWT local ativo).');
  }

  try {
    const alcadasService = app.get(AlcadasService);
    const firestoreService = app.get(FirestoreService);

    const existingCenters = await alcadasService.listCostCenters('startop');
    if (existingCenters.length === 0) {
      const startopDepts = [
        { id: 'dep-fin', code: 'CC-101', name: 'Controladoria & Finanças', monthlyBudget: 450000, color: '#f59e0b' },
        { id: 'dep-ti', code: 'CC-305', name: 'Tecnologia & Infraestrutura', monthlyBudget: 320000, color: '#644ef3' },
        { id: 'dep-eng', code: 'CC-204', name: 'Engenharia & Obras', monthlyBudget: 680000, color: '#10b981' },
        { id: 'dep-op', code: 'CC-402', name: 'Operações & Logística', monthlyBudget: 290000, color: '#ec4899' },
        { id: 'dep-jur', code: 'CC-501', name: 'Jurídico & Compliance', monthlyBudget: 150000, color: '#0284c7' },
      ];
      for (const d of startopDepts) {
        await firestoreService.setTenantDocument('startop', 'cost_centers', d.id, {
          id: d.id,
          tenantId: 'startop',
          code: d.code,
          name: d.name,
          monthlyBudget: d.monthlyBudget,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const existingTiers = await alcadasService.getApprovalTiers('startop');
    if (existingTiers.length === 0) {
      await alcadasService.upsertApprovalTiers('startop', {
        tiers: [
          { level: 'N1', approverRole: 'APROVADOR_N1', minAmount: 0, maxAmount: 15000 },
          { level: 'N2', approverRole: 'APROVADOR_N2', minAmount: 15000.01, maxAmount: 75000 },
          { level: 'N3', approverRole: 'DIRETOR_CFO', minAmount: 75000.01, maxAmount: null, unlimited: true },
        ],
      });
    }

    // Remove quaisquer solicitações ou fluxos de mock antigos do Firestore Emulator
    const db = getFirestore(getFirebaseApp());
    const mockSuppliers = new Set([
      'AWS Cloud Services Brasil',
      'Deloitte Auditoria & SecOps',
      'Construtora Solidez Engenharia',
      'MedSupply Hospitalar LTDA',
    ]);
    const reqsSnap = await db.collection('tenants').doc('startop').collection('requests').get();
    for (const doc of reqsSnap.docs) {
      const data = doc.data();
      if (mockSuppliers.has(String(data['fornecedor'] ?? ''))) {
        await doc.ref.delete();
      }
    }

    const mockWorkflowIds = new Set(['ALC-7781', 'ALC-7782', 'ALC-7783', 'ALC-7784']);
    const wfDoc = await db.collection('tenants').doc('startop').collection('workflows').doc('config').get();
    if (wfDoc.exists) {
      const items = (wfDoc.data()?.['items'] as Array<{ id?: string }> | undefined) ?? [];
      if (items.some((i) => i.id && mockWorkflowIds.has(i.id))) {
        await wfDoc.ref.set({ items: [], updatedAt: new Date().toISOString() });
      }
    }
  } catch {
    // Ignora caso o serviço de seed inicial falhe
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new FiltroErrosHttp());
  // Origens do frontend liberadas no CORS, separadas por vírgula (Plano Custo Zero — ADR-011).
  const origensPermitidas = (process.env['WEB_URL'] ?? 'http://localhost:4200').split(',').map((o) => o.trim());
  app.enableCors({ origin: origensPermitidas });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
  void seedDeveloperAccess(app);
}

bootstrap();
