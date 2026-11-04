import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'crypto';

// Configurações padrão de ambiente para emuladores
process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= 'localhost:9099';
process.env['FIRESTORE_EMULATOR_HOST'] ??= 'localhost:8080';
process.env['FIREBASE_PROJECT_ID'] ??= 'demo-alcadas';

const app = getApps().length > 0 ? getApps()[0] : initializeApp({ projectId: process.env['FIREBASE_PROJECT_ID'] });
const auth = getAuth(app);
const db = getFirestore(app);

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .filter((k) => record[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify(record[k])}`);
  return `{${entries.join(',')}}`;
}

function calcularHashElo(input: {
  hashAnterior: string;
  timestampUtc: string;
  authorId: string;
  tipoEvento: string;
  payload: Record<string, unknown>;
}): string {
  const rawData = `${input.hashAnterior}|${input.timestampUtc}|${input.authorId}|${input.tipoEvento}|${canonicalStringify(input.payload)}`;
  return createHash('sha256').update(rawData, 'utf8').digest('hex');
}

interface SeedUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  roles: string[];
  tenantId: string;
  maxApprovalLimit?: number | null;
  level?: string;
}

const SEED_USERS: SeedUser[] = [
  // Empresa A (Startop)
  {
    uid: 'startop-admin-01',
    email: 'admin@startop.test',
    displayName: 'Administrador Startop',
    role: 'ADMIN',
    roles: ['ADMIN'],
    tenantId: 'startop',
  },
  {
    uid: 'startop-solicitante-01',
    email: 'solicitante@startop.test',
    displayName: 'Carlos Eduardo (Solicitante)',
    role: 'SOLICITANTE',
    roles: ['SOLICITANTE'],
    tenantId: 'startop',
  },
  {
    uid: 'startop-gerente-01',
    email: 'gerente@startop.test',
    displayName: 'Mariana Vasconcelos (Gerente N2)',
    role: 'APROVADOR_N2',
    roles: ['APROVADOR_N2'],
    tenantId: 'startop',
    maxApprovalLimit: 5000,
    level: 'N2',
  },
  {
    uid: 'startop-auditor-01',
    email: 'auditor@startop.test',
    displayName: 'Patrícia Nogueira (Auditora)',
    role: 'AUDITOR',
    roles: ['AUDITOR'],
    tenantId: 'startop',
  },
  // Empresa B
  {
    uid: 'empresab-solicitante-01',
    email: 'solicitante@empresab.test',
    displayName: 'Solicitante Empresa B',
    role: 'SOLICITANTE',
    roles: ['SOLICITANTE'],
    tenantId: 'empresa-b',
  },
];

async function seedAuth(): Promise<void> {
  console.log('🌱 [SEED] Sincronizando contas no Firebase Auth Emulator...');
  for (const u of SEED_USERS) {
    const claims = {
      tenantId: u.tenantId,
      role: u.role,
      roles: u.roles,
      name: u.displayName,
      ...(u.maxApprovalLimit !== undefined ? { maxApprovalLimit: u.maxApprovalLimit, limiteAlcada: u.maxApprovalLimit } : {}),
      ...(u.level ? { level: u.level } : {}),
    };

    try {
      const existing = await auth.getUserByEmail(u.email);
      await auth.updateUser(existing.uid, {
        displayName: u.displayName,
        password: '123456',
        disabled: false,
      });
      await auth.setCustomUserClaims(existing.uid, claims);
      console.log(`  ✓ Usuário atualizado: ${u.email} (${u.role}) [tenant: ${u.tenantId}]`);
    } catch {
      const created = await auth.createUser({
        uid: u.uid,
        email: u.email,
        password: '123456',
        displayName: u.displayName,
        emailVerified: true,
        disabled: false,
      });
      await auth.setCustomUserClaims(created.uid, claims);
      console.log(`  ✓ Usuário criado: ${u.email} (${u.role}) [tenant: ${u.tenantId}]`);
    }
  }
}

async function seedFirestore(): Promise<void> {
  console.log('🌱 [SEED] Sincronizando coleções no Firestore Emulator...');
  const now = new Date().toISOString();

  // 1. Organizações SaaS (Plataforma Global e Tenant Individual)
  const tenantStartopData = {
    tenantId: 'startop',
    plan: 'ENTERPRISE',
    status: 'ATIVO',
    createdAt: now,
    maxUsers: 50,
    ownerName: 'Administrador Startop',
    ownerEmail: 'admin@startop.test',
    ownerRole: 'ADMIN',
    organization: {
      cnpj: '11.222.333/0001-81',
      legalName: 'Startop Sistemas & Governança Corporativa LTDA',
      tradeName: 'Startop Enterprise',
      stateRegistration: '07.482.910/001-45',
      taxRegime: 'Lucro Real',
      corporateEmail: 'governanca@startop.com.br',
      corporatePhone: '+55 (61) 3321-8900',
      website: 'https://startop.com.br',
      address: {
        zip: '70070-120',
        street: 'SBS Quadra 2 Bloco E',
        number: '206',
        city: 'Brasília',
        state: 'DF',
      },
      departments: [
        {
          id: 'dept-startop-ops',
          code: 'CC001',
          name: 'Operações & Logística',
          costCenter: 'CC001',
          monthlyBudget: 100000,
          managerName: 'Mariana Vasconcelos',
          color: '#2563eb',
        },
        {
          id: 'dept-startop-tech',
          code: 'CC002',
          name: 'Tecnologia & Inovação',
          costCenter: 'CC002',
          monthlyBudget: 150000,
          managerName: 'Mariana Vasconcelos',
          color: '#059669',
        },
      ],
      employees: [
        {
          id: 'emp-startop-admin',
          employeeCode: 'STP-0001',
          fullName: 'Administrador Startop',
          email: 'admin@startop.test',
          phone: '+55 (61) 99111-0001',
          jobTitle: 'Administrador Geral',
          role: 'ADMINISTRADOR',
          departmentId: 'dept-startop-ops',
          departmentName: 'Operações & Logística',
          approvalLimit: 0,
          status: 'ATIVO',
          joinedAt: now,
          isCompanyAdmin: true,
        },
        {
          id: 'emp-startop-sol',
          employeeCode: 'STP-0002',
          fullName: 'Carlos Eduardo',
          email: 'solicitante@startop.test',
          phone: '+55 (61) 99111-0002',
          jobTitle: 'Analista de Operações',
          role: 'SOLICITANTE',
          departmentId: 'dept-startop-ops',
          departmentName: 'Operações & Logística',
          approvalLimit: 0,
          status: 'ATIVO',
          joinedAt: now,
        },
        {
          id: 'emp-startop-ger',
          employeeCode: 'STP-0003',
          fullName: 'Mariana Vasconcelos',
          email: 'gerente@startop.test',
          phone: '+55 (61) 99111-0003',
          jobTitle: 'Gerente Departamental N2',
          role: 'GERENTE',
          departmentId: 'dept-startop-ops',
          departmentName: 'Operações & Logística',
          approvalLimit: 5000,
          status: 'ATIVO',
          joinedAt: now,
        },
        {
          id: 'emp-startop-aud',
          employeeCode: 'STP-0004',
          fullName: 'Patrícia Nogueira',
          email: 'auditor@startop.test',
          phone: '+55 (61) 99111-0004',
          jobTitle: 'Auditora de Riscos & Compliance',
          role: 'AUDITOR',
          departmentId: 'dept-startop-ops',
          departmentName: 'Operações & Logística',
          approvalLimit: 0,
          status: 'ATIVO',
          joinedAt: now,
        },
      ],
      policies: {},
    },
    profissoes: [],
  };

  const tenantEmpresaBData = {
    tenantId: 'empresa-b',
    plan: 'PRO',
    status: 'ATIVO',
    createdAt: now,
    maxUsers: 10,
    ownerName: 'Solicitante Empresa B',
    ownerEmail: 'solicitante@empresab.test',
    ownerRole: 'SOLICITANTE',
    organization: {
      cnpj: '99.888.777/0001-66',
      legalName: 'Empresa B Inovações Comerciais LTDA',
      tradeName: 'Empresa B',
      stateRegistration: '09.123.456/001-88',
      taxRegime: 'Lucro Presumido',
      corporateEmail: 'contato@empresab.test',
      corporatePhone: '+55 (11) 3200-1100',
      website: 'https://empresab.test',
      address: {
        zip: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        city: 'São Paulo',
        state: 'SP',
      },
      departments: [
        {
          id: 'dept-empb-01',
          code: 'CCB01',
          name: 'Engenharia Empresa B',
          costCenter: 'CCB01',
          monthlyBudget: 50000,
          managerName: 'Gestor Empresa B',
          color: '#d97706',
        },
      ],
      employees: [
        {
          id: 'emp-empb-sol',
          employeeCode: 'EPB-0001',
          fullName: 'Solicitante Empresa B',
          email: 'solicitante@empresab.test',
          phone: '+55 (11) 98888-0001',
          jobTitle: 'Engenheiro de Compras',
          role: 'SOLICITANTE',
          departmentId: 'dept-empb-01',
          departmentName: 'Engenharia Empresa B',
          approvalLimit: 0,
          status: 'ATIVO',
          joinedAt: now,
        },
      ],
      policies: {},
    },
    profissoes: [],
  };

  // Salva no registro SaaS global e na organização de cada tenant
  await db.collection('tenants').doc('platform-saas').collection('saas_tenants').doc('startop').set(tenantStartopData);
  await db.collection('tenants').doc('startop').collection('organization').doc('config').set(tenantStartopData);

  await db.collection('tenants').doc('platform-saas').collection('saas_tenants').doc('empresa-b').set(tenantEmpresaBData);
  await db.collection('tenants').doc('empresa-b').collection('organization').doc('config').set(tenantEmpresaBData);

  // 2. Centros de Custo
  // Startop
  await db.collection('tenants').doc('startop').collection('cost_centers').doc('cc-startop-01').set({
    id: 'cc-startop-01',
    tenantId: 'startop',
    code: 'CC001',
    name: 'Operações & Logística',
    monthlyBudget: 100000,
    department: 'Operações & Logística',
    managerName: 'Mariana Vasconcelos',
    color: '#2563eb',
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('tenants').doc('startop').collection('cost_centers').doc('cc-startop-02').set({
    id: 'cc-startop-02',
    tenantId: 'startop',
    code: 'CC002',
    name: 'Tecnologia & Inovação',
    monthlyBudget: 150000,
    department: 'Tecnologia & Inovação',
    managerName: 'Mariana Vasconcelos',
    color: '#059669',
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  // Empresa B
  await db.collection('tenants').doc('empresa-b').collection('cost_centers').doc('cc-empresab-01').set({
    id: 'cc-empresab-01',
    tenantId: 'empresa-b',
    code: 'CCB01',
    name: 'Engenharia Empresa B',
    monthlyBudget: 50000,
    department: 'Engenharia Empresa B',
    managerName: 'Gestor Empresa B',
    color: '#d97706',
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  // 3. Faixas de Alçada (Approval Tiers - N1, N2, N3)
  const tiers = [
    { level: 'N1', approverRole: 'APROVADOR_N1', minAmount: 0, maxAmount: 1000, unlimited: false },
    { level: 'N2', approverRole: 'APROVADOR_N2', minAmount: 1000.01, maxAmount: 5000, unlimited: false },
    { level: 'N3', approverRole: 'DIRETOR_CFO', minAmount: 5000.01, maxAmount: null, unlimited: true },
  ];

  for (const t of tiers) {
    await db.collection('tenants').doc('startop').collection('approval_tiers').doc(`tier-${t.level.toLowerCase()}`).set({
      id: `tier-${t.level.toLowerCase()}`,
      tenantId: 'startop',
      ...t,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('tenants').doc('empresa-b').collection('approval_tiers').doc(`tier-${t.level.toLowerCase()}`).set({
      id: `tier-${t.level.toLowerCase()}`,
      tenantId: 'empresa-b',
      ...t,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 4. Solicitação da Empresa B (para teste de isolamento)
  const solEmpresaBId = 'sol-empresa-b-01';
  const solEmpresaBPayload = {
    id: solEmpresaBId,
    tenantId: 'empresa-b',
    centroCustoId: 'cc-empresab-01',
    valor: 2500,
    categoria: 'SERVICOS',
    justificativa: 'Consultoria técnica externa de auditoria e validação de isolamento multi-tenant',
    status: 'PENDENTE',
    versao: 1,
    solicitanteId: 'empresab-solicitante-01',
    solicitanteNome: 'Solicitante Empresa B',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('tenants').doc('empresa-b').collection('requests').doc(solEmpresaBId).set(solEmpresaBPayload);

  const hashEmpresaB = calcularHashElo({
    hashAnterior: GENESIS_HASH,
    timestampUtc: now,
    authorId: 'empresab-solicitante-01',
    tipoEvento: 'CRIACAO_SOLICITACAO',
    payload: {
      centroCustoId: 'cc-empresab-01',
      valor: 2500,
      categoria: 'SERVICOS',
      justificativa: 'Consultoria técnica externa de auditoria e validação de isolamento multi-tenant',
    },
  });

  await db.collection('tenants').doc('empresa-b').collection('requests').doc(solEmpresaBId).collection('audit_blocks').doc('1').set({
    sequencia: 1,
    solicitacaoId: solEmpresaBId,
    tenantId: 'empresa-b',
    tipoEvento: 'CRIACAO_SOLICITACAO',
    authorId: 'empresab-solicitante-01',
    timestampUtc: now,
    hashAnterior: GENESIS_HASH,
    hashAtual: hashEmpresaB,
    payload: {
      centroCustoId: 'cc-empresab-01',
      valor: 2500,
      categoria: 'SERVICOS',
    },
  });

  // 5. Solicitação da Empresa A (Startop) para demonstração imediata
  const solStartopId = 'sol-startop-01';
  const solStartopPayload = {
    id: solStartopId,
    tenantId: 'startop',
    centroCustoId: 'cc-startop-01',
    valor: 3200,
    categoria: 'EQUIPAMENTOS',
    justificativa: 'Aquisição de notebooks de alto desempenho para o time de engenharia',
    status: 'PENDENTE',
    versao: 1,
    solicitanteId: 'startop-solicitante-01',
    solicitanteNome: 'Carlos Eduardo',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('tenants').doc('startop').collection('requests').doc(solStartopId).set(solStartopPayload);

  const hashStartop = calcularHashElo({
    hashAnterior: GENESIS_HASH,
    timestampUtc: now,
    authorId: 'startop-solicitante-01',
    tipoEvento: 'CRIACAO_SOLICITACAO',
    payload: {
      centroCustoId: 'cc-startop-01',
      valor: 3200,
      categoria: 'EQUIPAMENTOS',
      justificativa: 'Aquisição de notebooks de alto desempenho para o time de engenharia',
    },
  });

  await db.collection('tenants').doc('startop').collection('requests').doc(solStartopId).collection('audit_blocks').doc('1').set({
    sequencia: 1,
    solicitacaoId: solStartopId,
    tenantId: 'startop',
    tipoEvento: 'CRIACAO_SOLICITACAO',
    authorId: 'startop-solicitante-01',
    timestampUtc: now,
    hashAnterior: GENESIS_HASH,
    hashAtual: hashStartop,
    payload: {
      centroCustoId: 'cc-startop-01',
      valor: 3200,
      categoria: 'EQUIPAMENTOS',
    },
  });

  console.log('  ✓ Organizações, centros de custo, alçadas e solicitações semeados no Firestore!');
}

async function aguardarEmuladores(): Promise<void> {
  const authHost = process.env['FIREBASE_AUTH_EMULATOR_HOST'] || 'localhost:9099';
  const [authH, authP] = authHost.split(':');
  const firestoreHost = process.env['FIRESTORE_EMULATOR_HOST'] || 'localhost:8080';
  const [fsH, fsP] = firestoreHost.split(':');

  const net = await import('net');
  const check = (host: string, port: number) =>
    new Promise<boolean>((resolve) => {
      const socket = net.connect(port, host);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
    });

  console.log(`⏳ [SEED] Aguardando prontidão dos emuladores (${authHost} e ${firestoreHost})...`);
  for (let i = 0; i < 30; i++) {
    const authOk = await check(authH, Number(authP));
    const fsOk = await check(fsH, Number(fsP));
    if (authOk && fsOk) {
      console.log('✅ [SEED] Emuladores prontos e respondendo nas portas.');
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main(): Promise<void> {
  console.log('🚀 Iniciando script de seed automatizado do Checkpoint 2...');
  try {
    await aguardarEmuladores();
    await seedAuth();
    await seedFirestore();
    console.log('✅ [SEED] Sucesso total! Todos os dados de teste foram carregados com êxito.');
    process.exit(0);
  } catch (error) {
    console.error('❌ [SEED] Erro ao carregar dados no emulador:', error);
    process.exit(1);
  }
}

void main();
