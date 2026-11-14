/**
 * Seed mínimo e idempotente de PRODUÇÃO (Issue #32 / RF01 / FinOps).
 *
 * Carrega o mínimo para um usuário externo conseguir entrar e executar uma jornada:
 * - a organização Startop (registro da plataforma + configuração do tenant);
 * - centros de custo e faixas de alçada padrão (N1, N2, N3);
 * - um usuário por papel no Firebase Auth: Solicitante, Gerente, Diretor e CFO.
 *
 * Idempotência: os ids são fixos e o script só CRIA o que ainda não existe. Rodar de novo não
 * duplica nada, não sobrescreve o que o administrador já alterou e não redefine senhas.
 *
 * Cotas (plano Spark): 8 leituras por execução e, só na primeira, 8 escritas no Firestore mais
 * 4 contas no Auth — muito abaixo de 50.000 leituras e 20.000 escritas por dia.
 *
 * Segredos: as senhas provisórias vêm de variáveis de ambiente e nunca são impressas nem
 * versionadas. Troque-as no primeiro acesso.
 *
 * Uso em produção:
 *   FIREBASE_PROJECT_ID=<projeto> \
 *   FIREBASE_SERVICE_ACCOUNT_JSON='<json da conta de serviço, puro ou base64>' \
 *   SEED_SENHA_SOLICITANTE=... SEED_SENHA_GERENTE=... SEED_SENHA_DIRETOR=... SEED_SENHA_CFO=... \
 *   SEED_CONFIRMAR=producao \
 *   npm run seed:prod
 *
 * Ensaio nos emuladores (não exige credencial nem SEED_CONFIRMAR):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIREBASE_PROJECT_ID=demo-alcadas SEED_SENHA_SOLICITANTE=... (demais senhas) npm run seed:prod
 *
 * Variáveis opcionais: SEED_DOMINIO_EMAIL (padrão `startop.com.br`) e
 * SEED_EMAIL_SOLICITANTE / _GERENTE / _DIRETOR / _CFO para informar e-mails reais.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

const TENANT_ID = 'startop';
const TENANT_DA_PLATAFORMA = 'platform-saas';
const TAMANHO_MINIMO_SENHA = 10;

type PapelSeed = 'SOLICITANTE' | 'GERENTE' | 'DIRETOR' | 'CFO';

interface UsuarioSeed {
  papel: PapelSeed;
  uid: string;
  nome: string;
  cargo: string;
  /** Papel (claim `role`) usado pelo RBAC da API. */
  role: 'SOLICITANTE' | 'APROVADOR_N2' | 'DIRETOR_CFO';
  level?: 'N2' | 'N3';
  limiteAlcada: number | null;
  departamentoId: string;
}

const DEPARTAMENTOS = [
  { id: 'dep-fin', code: 'CC-101', name: 'Controladoria & Finanças', monthlyBudget: 450000, color: '#f59e0b' },
  { id: 'dep-ti', code: 'CC-305', name: 'Tecnologia & Infraestrutura', monthlyBudget: 320000, color: '#644ef3' },
  { id: 'dep-op', code: 'CC-402', name: 'Operações & Logística', monthlyBudget: 290000, color: '#ec4899' },
];

const FAIXAS_DE_ALCADA = [
  { level: 'N1', approverRole: 'APROVADOR_N1', roleTitle: 'Coordenador', minAmount: 0.01, maxAmount: 15000 },
  { level: 'N2', approverRole: 'APROVADOR_N2', roleTitle: 'Gerente', minAmount: 15000.01, maxAmount: 75000 },
  { level: 'N3', approverRole: 'DIRETOR_CFO', roleTitle: 'Diretor / CFO', minAmount: 75000.01, maxAmount: null },
] as const;

const USUARIOS: UsuarioSeed[] = [
  {
    papel: 'SOLICITANTE',
    uid: 'startop-solicitante',
    nome: 'Solicitante Startop',
    cargo: 'Analista de Operações',
    role: 'SOLICITANTE',
    limiteAlcada: null,
    departamentoId: 'dep-op',
  },
  {
    papel: 'GERENTE',
    uid: 'startop-gerente',
    nome: 'Gerente Startop',
    cargo: 'Gerente Departamental',
    role: 'APROVADOR_N2',
    level: 'N2',
    limiteAlcada: 75000,
    departamentoId: 'dep-op',
  },
  {
    papel: 'DIRETOR',
    uid: 'startop-diretor',
    nome: 'Diretor Startop',
    cargo: 'Diretor de Operações',
    role: 'DIRETOR_CFO',
    level: 'N3',
    limiteAlcada: null,
    departamentoId: 'dep-op',
  },
  {
    papel: 'CFO',
    uid: 'startop-cfo',
    nome: 'CFO Startop',
    cargo: 'Diretor Financeiro (CFO)',
    role: 'DIRETOR_CFO',
    level: 'N3',
    limiteAlcada: null,
    departamentoId: 'dep-fin',
  },
];

function abortar(mensagem: string): never {
  console.error(`✖ [SEED-PROD] ${mensagem}`);
  process.exit(1);
}

function usandoEmuladores(): boolean {
  return Boolean(process.env['FIRESTORE_EMULATOR_HOST'] && process.env['FIREBASE_AUTH_EMULATOR_HOST']);
}

/** Confere destino e credencial antes de tocar no banco. */
function validarAmbiente(): void {
  const firestoreEmulado = Boolean(process.env['FIRESTORE_EMULATOR_HOST']);
  const authEmulado = Boolean(process.env['FIREBASE_AUTH_EMULATOR_HOST']);
  if (firestoreEmulado !== authEmulado) {
    abortar('Defina os DOIS emuladores (FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST) ou nenhum.');
  }
  if (!process.env['FIREBASE_PROJECT_ID']) {
    abortar('FIREBASE_PROJECT_ID é obrigatório.');
  }
  if (!usandoEmuladores()) {
    if (process.env['SEED_CONFIRMAR'] !== 'producao') {
      abortar('Este script grava no Firebase REAL. Confirme com SEED_CONFIRMAR=producao.');
    }
    if (!process.env['FIREBASE_SERVICE_ACCOUNT_JSON'] && !process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
      abortar('Informe a credencial: FIREBASE_SERVICE_ACCOUNT_JSON ou GOOGLE_APPLICATION_CREDENTIALS.');
    }
  }
}

function emailDe(usuario: UsuarioSeed): string {
  const dominio = process.env['SEED_DOMINIO_EMAIL'] ?? 'startop.com.br';
  const informado = process.env[`SEED_EMAIL_${usuario.papel}`];
  return (informado ?? `${usuario.papel.toLowerCase()}@${dominio}`).trim().toLowerCase();
}

/** Senha provisória do papel, lida do ambiente. Só é exigida quando a conta ainda não existe. */
function senhaDe(usuario: UsuarioSeed): string {
  const variavel = `SEED_SENHA_${usuario.papel}`;
  const senha = process.env[variavel];
  if (!senha || senha.length < TAMANHO_MINIMO_SENHA) {
    abortar(`${variavel} é obrigatória e precisa ter ao menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
  }
  return senha;
}

function inicializarFirebase(): { auth: Auth; db: Firestore } {
  const bruto = process.env['FIREBASE_SERVICE_ACCOUNT_JSON']?.trim();
  let credencial;
  if (bruto && !usandoEmuladores()) {
    try {
      credencial = cert(JSON.parse(bruto.startsWith('{') ? bruto : Buffer.from(bruto, 'base64').toString('utf8')));
    } catch {
      abortar('FIREBASE_SERVICE_ACCOUNT_JSON inválida: esperado o JSON da conta de serviço (puro ou em base64).');
    }
  }
  const app =
    getApps()[0] ??
    initializeApp({
      projectId: process.env['FIREBASE_PROJECT_ID'],
      ...(credencial ? { credential: credencial } : {}),
    });
  return { auth: getAuth(app), db: getFirestore(app) };
}

/** Monta os documentos do seed, cada um com o seu caminho fixo. */
function montarDocumentos(agora: string): Array<{ caminho: string; dados: Record<string, unknown> }> {
  const colaboradores = USUARIOS.map((usuario, indice) => {
    const departamento = DEPARTAMENTOS.find((d) => d.id === usuario.departamentoId) ?? DEPARTAMENTOS[0];
    return {
      id: `emp-${usuario.uid}`,
      employeeCode: `STP-${String(indice + 1).padStart(4, '0')}`,
      fullName: usuario.nome,
      email: emailDe(usuario),
      phone: '',
      jobTitle: usuario.cargo,
      role: usuario.papel,
      departmentId: departamento.id,
      departmentName: departamento.name,
      approvalLimit: usuario.limiteAlcada ?? 0,
      status: 'ATIVO',
      joinedAt: agora,
    };
  });

  const organizacao = {
    tenantId: TENANT_ID,
    plan: 'ENTERPRISE',
    status: 'ATIVO',
    createdAt: agora,
    maxUsers: 50,
    ownerName: 'CFO Startop',
    ownerEmail: emailDe(USUARIOS[3]),
    ownerRole: 'CFO',
    organization: {
      cnpj: '',
      legalName: 'Startop LTDA',
      tradeName: 'Startop',
      stateRegistration: '',
      taxRegime: '',
      corporateEmail: '',
      corporatePhone: '',
      website: '',
      address: {},
      departments: DEPARTAMENTOS.map((d) => ({ ...d, costCenter: d.code, managerName: 'Gerente Startop' })),
      employees: colaboradores,
      policies: {},
    },
    profissoes: [],
  };

  return [
    { caminho: `tenants/${TENANT_DA_PLATAFORMA}/saas_tenants/${TENANT_ID}`, dados: organizacao },
    { caminho: `tenants/${TENANT_ID}/organization/config`, dados: organizacao },
    ...DEPARTAMENTOS.map((d) => ({
      caminho: `tenants/${TENANT_ID}/cost_centers/${d.id}`,
      dados: {
        id: d.id,
        tenantId: TENANT_ID,
        code: d.code,
        name: d.name,
        monthlyBudget: d.monthlyBudget,
        department: d.name,
        managerName: 'Gerente Startop',
        color: d.color,
        active: true,
        isActive: true,
        createdAt: agora,
        updatedAt: agora,
      },
    })),
    ...FAIXAS_DE_ALCADA.map((faixa) => ({
      caminho: `tenants/${TENANT_ID}/approval_tiers/tier-${faixa.level.toLowerCase()}`,
      dados: {
        id: `tier-${faixa.level.toLowerCase()}`,
        tenantId: TENANT_ID,
        ...faixa,
        unlimited: faixa.maxAmount === null,
        requiredApprovals: 1,
        updatedAt: agora,
      },
    })),
  ];
}

/** Uma leitura em lote para saber o que falta; uma escrita em lote só com o que falta. */
async function semearFirestore(db: Firestore): Promise<{ criados: number; existentes: number }> {
  const documentos = montarDocumentos(new Date().toISOString());
  const referencias = documentos.map((d) => db.doc(d.caminho));
  const atuais = await db.getAll(...referencias);

  const lote = db.batch();
  let criados = 0;
  atuais.forEach((atual, indice) => {
    if (!atual.exists) {
      lote.create(referencias[indice], documentos[indice].dados);
      criados++;
    }
  });
  if (criados > 0) {
    await lote.commit();
  }
  return { criados, existentes: documentos.length - criados };
}

async function semearUsuarios(auth: Auth): Promise<{ criados: number; existentes: number }> {
  let criados = 0;
  let existentes = 0;

  for (const usuario of USUARIOS) {
    const email = emailDe(usuario);
    const departamento = DEPARTAMENTOS.find((d) => d.id === usuario.departamentoId) ?? DEPARTAMENTOS[0];
    const claims = {
      tenantId: TENANT_ID,
      role: usuario.role,
      roles: [usuario.role],
      name: usuario.nome,
      departmentId: departamento.id,
      departmentName: departamento.name,
      costCenterId: departamento.code,
      limiteAlcada: usuario.limiteAlcada,
      ...(usuario.level ? { level: usuario.level } : {}),
    };

    let existente;
    try {
      existente = await auth.getUserByEmail(email);
    } catch (erro) {
      if ((erro as { code?: string }).code !== 'auth/user-not-found') throw erro;
    }

    if (existente) {
      existentes++;
      const atuais = existente.customClaims ?? {};
      if (atuais['tenantId'] && atuais['tenantId'] !== TENANT_ID) {
        abortar(`A conta do papel ${usuario.papel} já pertence a outra empresa; nada foi alterado nela.`);
      }
      // Só regrava as claims se estiverem diferentes. A senha de uma conta existente nunca é tocada.
      if (JSON.stringify(atuais) !== JSON.stringify(claims)) {
        await auth.setCustomUserClaims(existente.uid, claims);
      }
      console.log(`  = ${usuario.papel}: conta já existente (senha preservada).`);
      continue;
    }

    const criado = await auth.createUser({
      uid: usuario.uid,
      email,
      password: senhaDe(usuario),
      displayName: usuario.nome,
      emailVerified: true,
    });
    await auth.setCustomUserClaims(criado.uid, claims);
    criados++;
    console.log(`  + ${usuario.papel}: conta criada.`);
  }
  return { criados, existentes };
}

async function main(): Promise<void> {
  validarAmbiente();
  const destino = usandoEmuladores() ? 'EMULADORES' : `PRODUÇÃO (${process.env['FIREBASE_PROJECT_ID']})`;
  console.log(`🌱 [SEED-PROD] Destino: ${destino}`);

  const { auth, db } = inicializarFirebase();

  const firestore = await semearFirestore(db);
  console.log(`  Firestore: ${firestore.criados} documento(s) criado(s), ${firestore.existentes} já existente(s).`);

  const usuarios = await semearUsuarios(auth);
  console.log(`  Auth: ${usuarios.criados} conta(s) criada(s), ${usuarios.existentes} já existente(s).`);

  console.log('✔ [SEED-PROD] Concluído. Rodar novamente não duplica registros.');
}

main()
  .then(() => process.exit(0))
  .catch((erro: unknown) => {
    // Só o código/nome do erro: mensagens do SDK podem conter e-mails.
    const codigo = (erro as { code?: string }).code ?? (erro instanceof Error ? erro.name : 'erro');
    console.error(`✖ [SEED-PROD] Falhou (${codigo}).`);
    process.exit(1);
  });
