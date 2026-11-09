import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { APP_CONFIG } from '../../../core/config/app-config';
import { lerClaimsDoJwt } from '../../../core/auth/jwt';
import { UserProfile } from '../models/user-profile.model';
import {
  ApiKeyItem,
  EmployeeRoleType,
  IntegrationConnector,
  NotificationChannelItem,
  OrganizationData,
  OrganizationDepartment,
  OrganizationEmployee,
  OrganizationPolicies,
  SaasClientTenant,
  SaasPlanType,
  SaasTenantStatus,
  TenantProfession,
} from '../models/organization.model';

const STORAGE_KEY_TENANTS = 'alcadas.saas.tenants.v1';
const STORAGE_KEY_SESSION = 'alcadas.sessao';

export const TODAS_FUNCIONALIDADES_SISTEMA: string[] = [
  'dashboard',
  'minhas_aprovacoes',
  'solicitacoes',
  'meus_fluxos',
  'minhas_regras',
  'trilha',
  'motor_riscos',
  'delegacoes',
  'organizacao',
];

export function criarProfissoesPadrao(): TenantProfession[] {
  return [
    {
      id: 1,
      nome: 'Diretor',
      systemRole: 'DIRETOR_CFO',
      funcionalidades: [
        'dashboard',
        'minhas_aprovacoes',
        'meus_fluxos',
        'minhas_regras',
        'trilha',
        'motor_riscos',
        'delegacoes',
        'organizacao',
      ],
    },
    {
      id: 2,
      nome: 'Engenheiro',
      systemRole: 'SOLICITANTE',
      funcionalidades: ['solicitacoes'],
    },
    {
      id: 3,
      nome: 'Administrador',
      systemRole: 'ADMIN',
      funcionalidades: [
        'dashboard',
        'minhas_aprovacoes',
        'solicitacoes',
        'meus_fluxos',
        'minhas_regras',
        'delegacoes',
        'organizacao',
      ],
    },
    {
      id: 4,
      nome: 'Auditor',
      systemRole: 'AUDITOR',
      funcionalidades: ['dashboard', 'trilha', 'motor_riscos'],
    },
    {
      id: 5,
      nome: 'Gerente Aprovador',
      systemRole: 'APROVADOR_N2',
      funcionalidades: ['dashboard', 'minhas_aprovacoes', 'meus_fluxos'],
    },
  ];
}

export function mapearRoleParaProfissaoId(
  role: EmployeeRoleType,
  profissoes: TenantProfession[],
): number {
  const mapaNome: Record<EmployeeRoleType, string[]> = {
    DIRETOR: ['diretor', 'cfo'],
    CFO: ['diretor', 'cfo'],
    ADMINISTRADOR: ['administrador', 'admin'],
    GERENTE: ['gerente', 'aprovador', 'diretor'],
    ANALISTA: ['gerente', 'engenheiro', 'analista'],
    SOLICITANTE: ['engenheiro', 'solicitante'],
    AUDITOR: ['auditor'],
  };
  const candidatos = mapaNome[role] ?? ['engenheiro'];
  for (const termo of candidatos) {
    const achada = profissoes.find((p) => p.nome.toLowerCase().includes(termo));
    if (achada) return achada.id;
  }
  return profissoes[0]?.id ?? 1;
}

export function mapearProfissaoParaRole(nomeProfissao: string): EmployeeRoleType {
  const n = nomeProfissao.toLowerCase();
  if (n.includes('diretor')) return 'DIRETOR';
  if (n.includes('cfo')) return 'CFO';
  if (n.includes('admin')) return 'ADMINISTRADOR';
  if (n.includes('gerente') || n.includes('coordenador')) return 'GERENTE';
  if (n.includes('auditor') || n.includes('compliance')) return 'AUDITOR';
  if (n.includes('analista')) return 'ANALISTA';
  return 'SOLICITANTE';
}

export function mapearRoleParaClaimBackend(
  role: EmployeeRoleType,
): 'ADMIN' | 'DIRETOR_CFO' | 'APROVADOR_N2' | 'APROVADOR_N1' | 'SOLICITANTE' | 'AUDITOR' {
  switch (role) {
    case 'DIRETOR':
    case 'CFO':
      return 'DIRETOR_CFO';
    case 'ADMINISTRADOR':
      return 'ADMIN';
    case 'GERENTE':
      return 'APROVADOR_N2';
    case 'ANALISTA':
      return 'APROVADOR_N1';
    case 'AUDITOR':
      return 'AUDITOR';
    default:
      return 'SOLICITANTE';
  }
}

function criarTenantsIniciais(): SaasClientTenant[] {
  const startopOrg: OrganizationData = {
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
      street: 'SBS Quadra 2 Bloco E Edifício Prime Business',
      number: '206',
      complement: 'Andar 14 · Conjuntos 1401 a 1408',
      district: 'Asa Sul',
      city: 'Brasília',
      state: 'DF',
    },
    departments: [
      {
        id: 'dep-fin',
        code: 'FIN',
        name: 'Controladoria & Finanças',
        costCenter: 'CC-101',
        monthlyBudget: 450000,
        managerName: 'Julia Campos Santana',
        color: '#f59e0b',
      },
      {
        id: 'dep-ti',
        code: 'TI',
        name: 'Tecnologia & Infraestrutura',
        costCenter: 'CC-305',
        monthlyBudget: 320000,
        managerName: 'Rafael Costa Mendes',
        color: '#644ef3',
      },
      {
        id: 'dep-eng',
        code: 'ENG',
        name: 'Engenharia & Obras',
        costCenter: 'CC-204',
        monthlyBudget: 680000,
        managerName: 'Carlos Eduardo Lima',
        color: '#10b981',
      },
      {
        id: 'dep-op',
        code: 'OPE',
        name: 'Operações & Logística',
        costCenter: 'CC-402',
        monthlyBudget: 290000,
        managerName: 'Mariana Alves Rocha',
        color: '#ec4899',
      },
      {
        id: 'dep-jur',
        code: 'JUR',
        name: 'Jurídico & Compliance',
        costCenter: 'CC-501',
        monthlyBudget: 150000,
        managerName: 'Dr. Henrique Vasconcelos',
        color: '#0284c7',
      },
      {
        id: 'dep-rh',
        code: 'RH',
        name: 'Recursos Humanos',
        costCenter: 'CC-103',
        monthlyBudget: 220000,
        managerName: 'Ana Paula Nogueira',
        color: '#8b5cf6',
      },
    ],
    employees: [
      {
        id: 'emp-1',
        employeeCode: 'STP-0142',
        fullName: 'Julia Campos Santana',
        email: 'julia.santana@startop.com.br',
        phone: '+55 (61) 99350-0062',
        jobTitle: 'Gerente Financeira Sênior',
        role: 'GERENTE',
        departmentId: 'dep-fin',
        departmentName: 'Controladoria & Finanças',
        approvalLimit: 50000,
        status: 'ATIVO',
        joinedAt: '12/03/2023',
        password: '123456',
        profissaoId: 5,
      },
      {
        id: 'emp-2',
        employeeCode: 'STP-0018',
        fullName: 'Mariana Alves Rocha',
        email: 'mariana.alves@startop.com.br',
        phone: '+55 (61) 99812-4410',
        jobTitle: 'Diretora de Operações (COO)',
        role: 'DIRETOR',
        departmentId: 'dep-op',
        departmentName: 'Operações & Logística',
        approvalLimit: 200000,
        status: 'ATIVO',
        joinedAt: '05/01/2022',
        password: '123456',
        profissaoId: 1,
        isCompanyAdmin: true,
      },
      {
        id: 'emp-3',
        employeeCode: 'STP-0094',
        fullName: 'Rafael Costa Mendes',
        email: 'rafael.costa@startop.com.br',
        phone: '+55 (11) 98741-3302',
        jobTitle: 'Head de Tecnologia & Cloud',
        role: 'ADMINISTRADOR',
        departmentId: 'dep-ti',
        departmentName: 'Tecnologia & Infraestrutura',
        approvalLimit: 75000,
        status: 'ATIVO',
        joinedAt: '19/08/2023',
        password: '123456',
        profissaoId: 3,
        isCompanyAdmin: true,
      },
      {
        id: 'emp-4',
        employeeCode: 'STP-0115',
        fullName: 'Carlos Eduardo Lima',
        email: 'carlos.lima@startop.com.br',
        phone: '+55 (11) 97210-1988',
        jobTitle: 'Engenheiro Líder de Expansão',
        role: 'ANALISTA',
        departmentId: 'dep-eng',
        departmentName: 'Engenharia & Obras',
        approvalLimit: 15000,
        status: 'ATIVO',
        joinedAt: '10/02/2024',
        password: '123456',
        profissaoId: 2,
      },
      {
        id: 'emp-5',
        employeeCode: 'STP-0203',
        fullName: 'Ana Clara Souza',
        email: 'ana.souza@startop.com.br',
        phone: '+55 (61) 99123-7741',
        jobTitle: 'Analista de Suprimentos Pleno',
        role: 'SOLICITANTE',
        departmentId: 'dep-op',
        departmentName: 'Operações & Logística',
        approvalLimit: 0,
        status: 'ATIVO',
        joinedAt: '03/06/2024',
        password: '123456',
        profissaoId: 2,
      },
      {
        id: 'emp-6',
        employeeCode: 'STP-0041',
        fullName: 'Henrique Vasconcelos',
        email: 'henrique.juridico@startop.com.br',
        phone: '+55 (61) 98400-5120',
        jobTitle: 'Auditor de Riscos & Compliance',
        role: 'AUDITOR',
        departmentId: 'dep-jur',
        departmentName: 'Jurídico & Compliance',
        approvalLimit: 30000,
        status: 'FERIAS',
        joinedAt: '14/05/2022',
        password: '123456',
        profissaoId: 4,
      },
    ],
    policies: {
      defaultCurrency: 'BRL',
      autoApproveBelow: 500,
      defaultSlaHours: 24,
      autoEscalateOnSla: true,
      strictSod: true,
      requireCryptographicSignature: true,
      dualApprovalThreshold: 100000,
      minQuotesCount: 3,
      minQuotesThreshold: 10000,
      requireCostCenterOnRequests: true,
      auditRetentionYears: 7,
    },
  };

  const nagoyaOrg: OrganizationData = {
    cnpj: '45.987.123/0001-08',
    legalName: 'Nagoya Indústria & Tecnologia Automotiva S.A.',
    tradeName: 'Nagoya Company',
    stateRegistration: '110.042.490.114',
    taxRegime: 'Lucro Real',
    corporateEmail: 'diretoria@nagoya.com.br',
    corporatePhone: '+55 (11) 4002-8922',
    website: 'https://nagoya.com.br',
    address: {
      zip: '04538-132',
      street: 'Av. Brigadeiro Faria Lima',
      number: '3477',
      complement: 'Torre Norte · 18º Andar',
      district: 'Itaim Bibi',
      city: 'São Paulo',
      state: 'SP',
    },
    departments: [
      {
        id: 'nag-dep-dir',
        code: 'DIR',
        name: 'Diretoria & Estratégia',
        costCenter: 'CC-NAG-01',
        monthlyBudget: 850000,
        managerName: 'Roberto Takahashi',
        color: '#644ef3',
      },
      {
        id: 'nag-dep-eng',
        code: 'ENG',
        name: 'Engenharia Industrial',
        costCenter: 'CC-NAG-02',
        monthlyBudget: 520000,
        managerName: 'Lucas Watanabe',
        color: '#10b981',
      },
    ],
    employees: [
      {
        id: 'nag-emp-1',
        employeeCode: 'NAG-0001',
        fullName: 'Roberto Takahashi',
        email: 'roberto@nagoya.com.br',
        phone: '+55 (11) 99800-1001',
        jobTitle: 'CEO & Diretor Geral',
        role: 'DIRETOR',
        departmentId: 'nag-dep-dir',
        departmentName: 'Diretoria & Estratégia',
        approvalLimit: 500000,
        status: 'ATIVO',
        joinedAt: '10/01/2025',
        password: '123456',
        profissaoId: 1,
        isCompanyAdmin: true,
      },
      {
        id: 'nag-emp-2',
        employeeCode: 'NAG-0002',
        fullName: 'Lucas Watanabe',
        email: 'lucas@nagoya.com.br',
        phone: '+55 (11) 99800-1002',
        jobTitle: 'Engenheiro de Produção',
        role: 'SOLICITANTE',
        departmentId: 'nag-dep-eng',
        departmentName: 'Engenharia Industrial',
        approvalLimit: 0,
        status: 'ATIVO',
        joinedAt: '15/02/2025',
        password: '123456',
        profissaoId: 2,
      },
    ],
    policies: {
      defaultCurrency: 'BRL',
      autoApproveBelow: 1000,
      defaultSlaHours: 18,
      autoEscalateOnSla: true,
      strictSod: true,
      requireCryptographicSignature: true,
      dualApprovalThreshold: 150000,
      minQuotesCount: 3,
      minQuotesThreshold: 15000,
      requireCostCenterOnRequests: true,
      auditRetentionYears: 7,
    },
  };

  return [
    {
      tenantId: 'startop',
      plan: 'ENTERPRISE',
      status: 'ATIVO',
      createdAt: '05/01/2024',
      maxUsers: 100,
      ownerName: 'Mariana Alves Rocha',
      ownerEmail: 'mariana.alves@startop.com.br',
      ownerRole: 'DIRETOR',
      organization: startopOrg,
      profissoes: criarProfissoesPadrao(),
    },
    {
      tenantId: 'nagoya-corp',
      plan: 'ENTERPRISE',
      status: 'ATIVO',
      createdAt: '10/01/2025',
      maxUsers: 50,
      ownerName: 'Roberto Takahashi',
      ownerEmail: 'roberto@nagoya.com.br',
      ownerRole: 'DIRETOR',
      organization: nagoyaOrg,
      profissoes: criarProfissoesPadrao(),
    },
  ];
}

function carregarTenantsSalvos(): SaasClientTenant[] {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY_TENANTS);
    if (!bruto) return criarTenantsIniciais();
    const parsed: unknown = JSON.parse(bruto);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as SaasClientTenant[]).map((t) => ({
        ...t,
        profissoes: (t.profissoes || criarProfissoesPadrao()).map((p) => {
          if (p.systemRole === 'APROVADOR_N2' || p.systemRole === 'DIRETOR_CFO') {
            return {
              ...p,
              funcionalidades: p.funcionalidades.filter((f) => f !== 'solicitacoes'),
            };
          }
          return p;
        }),
      }));
    }
    return criarTenantsIniciais();
  } catch {
    return criarTenantsIniciais();
  }
}

function salvarTenantsNoStorage(tenants: SaasClientTenant[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TENANTS, JSON.stringify(tenants));
  } catch {
    // Ignora se localStorage estiver bloqueado
  }
}

function lerContextoSessaoSalva(): {
  tenantId: string;
  email: string;
  role: string;
  name: string;
} {
  try {
    const bruto = sessionStorage.getItem(STORAGE_KEY_SESSION);
    if (!bruto) {
      return { tenantId: 'startop', email: '', role: '', name: '' };
    }
    const sessao = JSON.parse(bruto) as { idToken?: string };
    const claims = sessao?.idToken ? lerClaimsDoJwt(sessao.idToken) : null;
    return {
      tenantId: typeof claims?.['tenantId'] === 'string' && claims['tenantId'] ? claims['tenantId'] : 'startop',
      email: typeof claims?.['email'] === 'string' ? claims['email'] : '',
      role: typeof claims?.['role'] === 'string' ? claims['role'] : '',
      name: typeof claims?.['name'] === 'string' ? claims['name'] : '',
    };
  } catch {
    return { tenantId: 'startop', email: '', role: '', name: '' };
  }
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly appConfig = inject(APP_CONFIG, { optional: true });
  private readonly initialCtx = lerContextoSessaoSalva();

  readonly tenants = signal<SaasClientTenant[]>(carregarTenantsSalvos());
  readonly activeTenantId = signal<string>(this.initialCtx.tenantId);
  readonly activeUserEmail = signal<string>(this.initialCtx.email);
  readonly activeUserRole = signal<string>(this.initialCtx.role);

  readonly activeTenant = computed<SaasClientTenant>(() => {
    const lista = this.tenants();
    const id = this.activeTenantId();
    return lista.find((t) => t.tenantId === id) ?? lista[0];
  });

  readonly organization = computed<OrganizationData>(() => this.activeTenant().organization);
  readonly activeProfissoes = computed<TenantProfession[]>(() => this.activeTenant().profissoes);

  readonly isPlatformSuperAdmin = computed<boolean>(() => {
    const role = this.activeUserRole();
    const email = this.activeUserEmail().toLowerCase();
    return role === 'SUPER_USER' || email === 'dev@alcadas.com';
  });

  readonly userProfile = signal<UserProfile>({
    fullName: 'Desenvolvedor',
    displayName: 'Desenvolvedor',
    cpf: '000.000.000-00',
    bio: 'Conta de Acesso Geral de Desenvolvedor e Administração SaaS Multi-Tenant.',
    avatarUrl: null,
    avatarColor: '#0f172a',
    email: 'dev@alcadas.com',
    additionalEmails: [
      { email: 'dev@alcadas.com', isPrimary: true, verified: true },
    ],
    phone: '+55 (61) 99999-0000',
    location: 'Brasília, DF — Brasil',
    timezone: 'America/Sao_Paulo (GMT-03:00)',
    company: 'Startop Sistemas & Governança LTDA',
    cnpj: '11.222.333/0001-81',
    jobTitle: 'Desenvolvedor (Super Admin)',
    department: 'Engenharia de Plataforma',
    employeeId: 'DEV-0001',
    roles: ['SUPER_USER', 'Desenvolvedor', 'Admin Geral'],
    approvalLimit: 9999999,
    costCenters: [],
    activeDelegation: null,
    signatureStyle: 'drawn',
    certificateIssuer: 'ICP-Brasil · SHA-256 ECDSA Ativo',
    lastAccess: new Date(),
    isActive: true,
    recentApprovals: [],
  });

  readonly notifications = signal<NotificationChannelItem[]>([
    {
      id: 'notif-new-approval',
      title: 'Novas solicitações aguardando minha deliberação',
      description: 'Receba um aviso imediato quando uma requisição entrar na sua fila de alçada.',
      category: 'APROVACOES',
      emailEnabled: true,
      pushEnabled: true,
      whatsappEnabled: true,
    },
    {
      id: 'notif-sla-warning',
      title: 'Alerta preventivo de vencimento de SLA',
      description: 'Notificar 2 horas antes do prazo limite de aprovação expirar ou escalonar.',
      category: 'SLA',
      emailEnabled: true,
      pushEnabled: true,
      whatsappEnabled: false,
    },
    {
      id: 'notif-request-status',
      title: 'Atualizações nas minhas solicitações emitidas',
      description: 'Quando um aprovador aprovar, recusar ou solicitar revisão em um pedido seu.',
      category: 'APROVACOES',
      emailEnabled: true,
      pushEnabled: true,
      whatsappEnabled: false,
    },
    {
      id: 'notif-sod-conflict',
      title: 'Alertas do Motor Anti-Fraude e Conflito SoD',
      description: 'Avisos críticos de tentativa de fracionamento de despesa ou conflito de papéis.',
      category: 'SEGURANCA',
      emailEnabled: true,
      pushEnabled: true,
      whatsappEnabled: true,
    },
    {
      id: 'notif-weekly-digest',
      title: 'Relatório semanal de governança e execução orçamentária',
      description: 'Resumo executivo enviado toda segunda-feira às 08h com indicadores de alçada.',
      category: 'AUDITORIA',
      emailEnabled: true,
      pushEnabled: false,
      whatsappEnabled: false,
    },
  ]);

  readonly integrations = signal<IntegrationConnector[]>([
    {
      id: 'int-sap',
      name: 'SAP S/4HANA Cloud',
      provider: 'SAP SE',
      category: 'ERP',
      description: 'Sincroniza centros de custo, ordens de compra e bloqueio orçamentário em tempo real.',
      icon: 'dns',
      connected: true,
      lastSync: 'Há 12 minutos',
      endpointUrl: 'https://api.sap.startop.internal/v2/cost-centers',
    },
    {
      id: 'int-totvs',
      name: 'TOTVS Protheus',
      provider: 'TOTVS S.A.',
      category: 'ERP',
      description: 'Integração com módulo de compras, títulos financeiros e notas fiscais.',
      icon: 'account_balance',
      connected: false,
      lastSync: null,
    },
    {
      id: 'int-slack',
      name: 'Slack Enterprise Grid',
      provider: 'Salesforce / Slack',
      category: 'MENSAGERIA',
      description: 'Dispara notificações interativas de aprovação rápida nos canais dos gestores.',
      icon: 'forum',
      connected: true,
      lastSync: 'Ativo em #alcadas-alertas',
    },
    {
      id: 'int-icp',
      name: 'Validador ICP-Brasil & Carimbo de Tempo',
      provider: 'ITI / Bry Cert',
      category: 'ASSINATURA',
      description: 'Assinatura digital qualificada e hash criptográfico encadeado SHA-256.',
      icon: 'verified_user',
      connected: true,
      lastSync: 'Operacional (99.98% uptime)',
    },
  ]);

  readonly apiKeys = signal<ApiKeyItem[]>([
    {
      id: 'key-1',
      name: 'Conector ERP Produção (SAP)',
      prefix: 'alc_live_98f4...c21a',
      environment: 'production',
      createdAt: '10 Jan 2026',
      lastUsedAt: 'Há 4 minutos',
      scopes: ['requests:read', 'approvals:write', 'webhooks:trigger'],
    },
    {
      id: 'key-2',
      name: 'Ambiente de Homologação / QA',
      prefix: 'alc_test_41b0...8e09',
      environment: 'sandbox',
      createdAt: '18 Ago 2026',
      lastUsedAt: 'Ontem às 19:40',
      scopes: ['requests:read', 'rules:read'],
    },
  ]);

  constructor() {
    if (this.initialCtx.email) {
      this.sincronizarPerfilComColaboradorLogado(
        this.initialCtx.email,
        this.initialCtx.tenantId,
        this.initialCtx.name,
        this.initialCtx.role,
      );
    }
  }

  private get apiUrl(): string {
    return this.appConfig?.apiBaseUrl ?? '/api';
  }

  /**
   * Carrega os tenants persistidos no Firestore via API; se o Firestore estiver vazio,
   * envia os tenants atuais para o Firestore (garantindo sincronização de departamentos/centros de custo).
   */
  carregarOuSincronizarTenantsComBackend(): void {
    if (!this.http) return;
    this.http
      .get<{ items: SaasClientTenant[] }>(`${this.apiUrl}/saas/tenants`)
      .subscribe({
        next: (res) => {
          const remotos = Array.isArray(res?.items) ? res.items : [];
          if (remotos.length > 0) {
            const locais = this.tenants();
            const mapa = new Map<string, SaasClientTenant>();
            for (const l of locais) mapa.set(l.tenantId, l);
            for (const r of remotos) {
              if (r && r.tenantId && r.organization) {
                mapa.set(r.tenantId, r);
              }
            }
            const mesclados = Array.from(mapa.values());
            this.tenants.set(mesclados);
            salvarTenantsNoStorage(mesclados);
          } else {
            this.http
              ?.post(`${this.apiUrl}/saas/tenants/sync`, { tenants: this.tenants() })
              .subscribe({ error: () => undefined });
          }
        },
        error: () => undefined,
      });
  }

  private persistirTenantNoBackend(tenant: SaasClientTenant): void {
    if (!this.http) return;
    this.http
      .put(`${this.apiUrl}/saas/tenants/${encodeURIComponent(tenant.tenantId)}`, tenant)
      .subscribe({ error: () => undefined });
  }

  /**
   * Sincroniza o tenant ativo e os dados do perfil pessoal sempre que o usuário faz login ou troca de sessão.
   */
  syncSessionContext(ctx: { email?: string; tenantId?: string; role?: string; name?: string } | null): void {
    if (!ctx) {
      this.activeTenantId.set('startop');
      this.activeUserEmail.set('');
      this.activeUserRole.set('');
      return;
    }
    const tenantId = ctx.tenantId || 'startop';
    this.activeTenantId.set(tenantId);
    this.activeUserEmail.set(ctx.email || '');
    this.activeUserRole.set(ctx.role || '');
    if (ctx.email) {
      this.sincronizarPerfilComColaboradorLogado(ctx.email, tenantId, ctx.name, ctx.role);
    }
  }

  /**
   * Busca uma conta de cliente ou colaborador cadastrada em qualquer empresa (tenant) pelo e-mail.
   */
  findAccountByEmail(email: string): {
    tenant: SaasClientTenant;
    employee: OrganizationEmployee;
    profissao: TenantProfession;
  } | null {
    const emailLimpo = email.trim().toLowerCase();
    if (!emailLimpo) return null;

    for (const tenant of this.tenants()) {
      const emp = tenant.organization.employees.find(
        (e) => e.email.trim().toLowerCase() === emailLimpo,
      );
      if (emp) {
        const profId =
          emp.profissaoId ?? mapearRoleParaProfissaoId(emp.role, tenant.profissoes);
        const profissao =
          tenant.profissoes.find((p) => p.id === profId) ??
          tenant.profissoes[0] ??
          criarProfissoesPadrao()[0];
        return { tenant, employee: emp, profissao };
      }
    }
    return null;
  }

  /**
   * Retorna as chaves de funcionalidades liberadas para o usuário logado com base na matriz de Delegações (/delegacoes)
   * da empresa dele. O Admin Geral da plataforma (SUPER_USER) tem acesso a todas as telas.
   */
  readonly currentUserAllowedFeatures = computed<string[]>(() => {
    if (this.isPlatformSuperAdmin()) {
      return [...TODAS_FUNCIONALIDADES_SISTEMA, 'clientes'];
    }
    const email = this.activeUserEmail();
    const match = this.findAccountByEmail(email);
    if (match) {
      return match.profissao.funcionalidades;
    }
    const role = this.activeUserRole();
    if (role === 'ADMIN' || role === 'DIRETOR_CFO') {
      return [...TODAS_FUNCIONALIDADES_SISTEMA];
    }
    return [...TODAS_FUNCIONALIDADES_SISTEMA];
  });

  /**
   * Verifica se o usuário atual pode acessar uma determinada rota da aplicação conforme as delegações da empresa.
   */
  canCurrentUserAccessUrl(url: string): boolean {
    if (this.isPlatformSuperAdmin()) return true;
    const permitidas = this.currentUserAllowedFeatures();

    if (url.includes('/configuracoes/clientes')) {
      return this.isPlatformSuperAdmin();
    }
    if (url.includes('/configuracoes/delegacoes') || url.includes('/delegacoes')) {
      return permitidas.includes('delegacoes') || permitidas.includes('organizacao');
    }
    if (url.includes('/configuracoes/organizacao') || url.includes('/configuracoes/empresa')) {
      return permitidas.includes('organizacao') || permitidas.includes('delegacoes');
    }
    // Perfil pessoal, segurança e notificações estão sempre liberados para o próprio usuário logado
    if (url.includes('/configuracoes')) {
      return true;
    }
    if (url.includes('/aprovacoes')) return permitidas.includes('minhas_aprovacoes');
    if (url.includes('/solicitacoes')) return permitidas.includes('solicitacoes');
    if (url.includes('/alcadas/regras')) return permitidas.includes('minhas_regras');
    if (url.includes('/alcadas')) return permitidas.includes('meus_fluxos');
    if (url.includes('/auditoria')) return permitidas.includes('trilha');
    if (url.includes('/riscos')) return permitidas.includes('motor_riscos');
    if (url.includes('/dashboard')) return permitidas.includes('dashboard');
    return true;
  }

  getFirstAllowedRouteForCurrentUser(): string {
    const permitidas = this.currentUserAllowedFeatures();
    const mapaRota: Record<string, string> = {
      dashboard: '/dashboard',
      solicitacoes: '/solicitacoes',
      minhas_aprovacoes: '/aprovacoes',
      meus_fluxos: '/alcadas/minhas-alcadas',
      minhas_regras: '/alcadas/regras',
      trilha: '/auditoria',
      motor_riscos: '/riscos',
      delegacoes: '/configuracoes/delegacoes',
      organizacao: '/configuracoes/organizacao',
    };
    for (const chave of permitidas) {
      if (mapaRota[chave]) return mapaRota[chave];
    }
    return '/configuracoes/perfil';
  }

  // =========================================================================
  // GESTÃO SAAS MULTI-TENANT (CADASTRO DE EMPRESAS E CONTAS DE CLIENTES)
  // =========================================================================

  registerClientTenant(payload: {
    tenantId?: string;
    tradeName: string;
    legalName: string;
    cnpj: string;
    corporateEmail: string;
    corporatePhone: string;
    plan: SaasPlanType;
    maxUsers: number;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
    ownerJobTitle: string;
    ownerRole: EmployeeRoleType;
    ownerApprovalLimit: number;
  }): SaasClientTenant {
    const slugBase = (payload.tenantId || payload.tradeName)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const tenantId = slugBase || `empresa-${Date.now()}`;
    const sigla = payload.tradeName
      .replace(/[^A-Za-z]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'EMP';

    const profissoes = criarProfissoesPadrao();
    const profissaoId = mapearRoleParaProfissaoId(payload.ownerRole, profissoes);
    const deptId = `dep-${Date.now()}`;
    const hoje = new Intl.DateTimeFormat('pt-BR').format(new Date());

    const novoTenant: SaasClientTenant = {
      tenantId,
      plan: payload.plan,
      status: 'ATIVO',
      createdAt: hoje,
      maxUsers: payload.maxUsers || 50,
      ownerName: payload.ownerName.trim(),
      ownerEmail: payload.ownerEmail.trim().toLowerCase(),
      ownerRole: payload.ownerRole,
      profissoes,
      organization: {
        cnpj: payload.cnpj,
        legalName: payload.legalName.trim(),
        tradeName: payload.tradeName.trim(),
        stateRegistration: 'Isento / Em homologação',
        taxRegime: 'Lucro Real',
        corporateEmail: payload.corporateEmail.trim().toLowerCase(),
        corporatePhone: payload.corporatePhone.trim() || '+55 (11) 3000-0000',
        website: '',
        address: {
          zip: '01310-100',
          street: 'Av. Paulista',
          number: '1000',
          complement: 'Conjunto 101',
          district: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        },
        departments: [
          {
            id: deptId,
            code: 'DIR',
            name: 'Diretoria & Administração Geral',
            costCenter: `CC-${sigla}-01`,
            monthlyBudget: Math.max(payload.ownerApprovalLimit * 2, 200000),
            managerName: payload.ownerName.trim(),
            color: '#644ef3',
          },
        ],
        employees: [
          {
            id: `emp-${Date.now()}`,
            employeeCode: `${sigla}-0001`,
            fullName: payload.ownerName.trim(),
            email: payload.ownerEmail.trim().toLowerCase(),
            phone: payload.corporatePhone.trim(),
            jobTitle: payload.ownerJobTitle.trim() || 'Diretor Executivo',
            role: payload.ownerRole,
            departmentId: deptId,
            departmentName: 'Diretoria & Administração Geral',
            approvalLimit: payload.ownerApprovalLimit,
            status: 'ATIVO',
            joinedAt: hoje,
            password: payload.ownerPassword || '123456',
            profissaoId,
            isCompanyAdmin: true,
          },
        ],
        policies: {
          defaultCurrency: 'BRL',
          autoApproveBelow: 500,
          defaultSlaHours: 24,
          autoEscalateOnSla: true,
          strictSod: true,
          requireCryptographicSignature: true,
          dualApprovalThreshold: 100000,
          minQuotesCount: 3,
          minQuotesThreshold: 10000,
          requireCostCenterOnRequests: true,
          auditRetentionYears: 7,
        },
      },
    };

    this.tenants.update((lista) => {
      const atualizada = [novoTenant, ...lista];
      salvarTenantsNoStorage(atualizada);
      return atualizada;
    });
    this.persistirTenantNoBackend(novoTenant);

    return novoTenant;
  }

  addClientAccountToTenant(
    tenantId: string,
    payload: {
      fullName: string;
      email: string;
      password: string;
      jobTitle: string;
      role: EmployeeRoleType;
      approvalLimit: number;
      isCompanyAdmin?: boolean;
    },
  ): OrganizationEmployee | null {
    let criado: OrganizationEmployee | null = null;
    const hoje = new Intl.DateTimeFormat('pt-BR').format(new Date());

    this.tenants.update((lista) => {
      const atualizada = lista.map((t) => {
        if (t.tenantId !== tenantId) return t;
        const sigla =
          t.organization.tradeName
            .replace(/[^A-Za-z]/g, '')
            .slice(0, 3)
            .toUpperCase() || 'EMP';
        const dept = t.organization.departments[0];
        const profissaoId = mapearRoleParaProfissaoId(payload.role, t.profissoes);
        criado = {
          id: `emp-${Date.now()}`,
          employeeCode: `${sigla}-0${100 + t.organization.employees.length + 1}`,
          fullName: payload.fullName.trim(),
          email: payload.email.trim().toLowerCase(),
          phone: t.organization.corporatePhone,
          jobTitle: payload.jobTitle.trim() || 'Gestor Corporativo',
          role: payload.role,
          departmentId: dept?.id ?? 'dep-dir',
          departmentName: dept?.name ?? 'Diretoria Geral',
          approvalLimit: payload.approvalLimit,
          status: 'ATIVO',
          joinedAt: hoje,
          password: payload.password || '123456',
          profissaoId,
          isCompanyAdmin: payload.isCompanyAdmin ?? true,
        };
        return {
          ...t,
          organization: {
            ...t.organization,
            employees: [criado, ...t.organization.employees],
          },
        };
      });
      salvarTenantsNoStorage(atualizada);
      const atualizado = atualizada.find((t) => t.tenantId === tenantId);
      if (atualizado) {
        this.persistirTenantNoBackend(atualizado);
      }
      return atualizada;
    });

    return criado;
  }

  updateTenantStatus(tenantId: string, status: SaasTenantStatus): void {
    this.tenants.update((lista) => {
      const atualizada = lista.map((t) => (t.tenantId === tenantId ? { ...t, status } : t));
      salvarTenantsNoStorage(atualizada);
      const atualizado = atualizada.find((t) => t.tenantId === tenantId);
      if (atualizado) {
        this.persistirTenantNoBackend(atualizado);
      }
      return atualizada;
    });
  }

  removeTenant(tenantId: string): void {
    if (tenantId === 'startop') return;
    this.tenants.update((lista) => {
      const atualizada = lista.filter((t) => t.tenantId !== tenantId);
      salvarTenantsNoStorage(atualizada);
      return atualizada;
    });
    if (this.activeTenantId() === tenantId) {
      this.activeTenantId.set('startop');
    }
  }

  // =========================================================================
  // GESTÃO DE PROFISSÕES E DELEGAÇÕES DA EMPRESA ATIVA (/delegacoes)
  // =========================================================================

  updateActiveProfissoes(profissoes: TenantProfession[]): void {
    this.atualizarTenantAtivo((t) => ({
      ...t,
      profissoes,
    }));
  }

  // =========================================================================
  // GESTÃO DA ORGANIZAÇÃO ATIVA (/configuracoes/organizacao)
  // =========================================================================

  updateUserProfile(patch: Partial<UserProfile>): void {
    this.userProfile.update((prev) => ({
      ...prev,
      ...patch,
    }));
  }

  addContactEmail(email: string): boolean {
    const clean = email.trim().toLowerCase();
    if (!clean) return false;
    const exists = this.userProfile().additionalEmails.some(
      (e) => e.email.toLowerCase() === clean,
    );
    if (exists) return false;

    this.userProfile.update((prev) => ({
      ...prev,
      additionalEmails: [
        ...prev.additionalEmails,
        { email: clean, isPrimary: false, verified: false },
      ],
    }));
    return true;
  }

  removeContactEmail(email: string): void {
    this.userProfile.update((prev) => ({
      ...prev,
      additionalEmails: prev.additionalEmails.filter(
        (item) => item.email !== email || item.isPrimary,
      ),
    }));
  }

  setPrimaryEmail(email: string): void {
    this.userProfile.update((prev) => ({
      ...prev,
      email,
      additionalEmails: prev.additionalEmails.map((item) => ({
        ...item,
        isPrimary: item.email === email,
        verified: item.email === email ? true : item.verified,
      })),
    }));
  }

  updateCompanyDetails(
    patch: Partial<
      Pick<
        OrganizationData,
        | 'cnpj'
        | 'legalName'
        | 'tradeName'
        | 'stateRegistration'
        | 'taxRegime'
        | 'corporateEmail'
        | 'corporatePhone'
        | 'website'
        | 'address'
      >
    >,
  ): void {
    this.atualizarOrganizacaoAtiva((prev) => ({
      ...prev,
      ...patch,
    }));
    if (patch.legalName || patch.cnpj) {
      this.userProfile.update((u) => ({
        ...u,
        company: patch.legalName ?? u.company,
        cnpj: patch.cnpj ?? u.cnpj,
      }));
    }
  }

  addDepartment(dept: Omit<OrganizationDepartment, 'id'>): OrganizationDepartment {
    const created: OrganizationDepartment = {
      ...dept,
      id: `dep-${Date.now()}`,
    };
    this.atualizarOrganizacaoAtiva((prev) => ({
      ...prev,
      departments: [...prev.departments, created],
    }));
    return created;
  }

  updateDepartment(id: string, patch: Partial<OrganizationDepartment>): void {
    this.atualizarOrganizacaoAtiva((prev) => ({
      ...prev,
      departments: prev.departments.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }

  removeDepartment(id: string): void {
    this.atualizarOrganizacaoAtiva((prev) => ({
      ...prev,
      departments: prev.departments.filter((d) => d.id !== id),
    }));
  }

  addEmployee(emp: Omit<OrganizationEmployee, 'id' | 'joinedAt'>): OrganizationEmployee {
    const profissoes = this.activeProfissoes();
    const profissaoId = emp.profissaoId ?? mapearRoleParaProfissaoId(emp.role, profissoes);
    const created: OrganizationEmployee = {
      ...emp,
      id: `emp-${Date.now()}`,
      joinedAt: new Intl.DateTimeFormat('pt-BR').format(new Date()),
      password: emp.password || '123456',
      profissaoId,
    };
    this.atualizarOrganizacaoAtiva((prev) => ({
      ...prev,
      employees: [created, ...prev.employees],
    }));
    return created;
  }

  updateEmployee(id: string, patch: Partial<OrganizationEmployee>): void {
    const profissoes = this.activeProfissoes();
    this.atualizarOrganizacaoAtiva((prev) => ({
      ...prev,
      employees: prev.employees.map((e) => {
        if (e.id !== id) return e;
        const nextRole = patch.role ?? e.role;
        const nextProfissaoId =
          patch.profissaoId ??
          (patch.role ? mapearRoleParaProfissaoId(nextRole, profissoes) : e.profissaoId);
        return {
          ...e,
          ...patch,
          profissaoId: nextProfissaoId,
          password: patch.password || e.password || '123456',
        };
      }),
    }));
  }

  removeEmployee(id: string): void {
    this.atualizarOrganizacaoAtiva((prev) => ({
      ...prev,
      employees: prev.employees.filter((e) => e.id !== id),
    }));
  }

  updatePolicies(policies: OrganizationPolicies): void {
    this.atualizarOrganizacaoAtiva((prev) => ({
      ...prev,
      policies,
    }));
  }

  toggleNotification(
    id: string,
    channel: 'emailEnabled' | 'pushEnabled' | 'whatsappEnabled',
  ): void {
    this.notifications.update((items) =>
      items.map((item) =>
        item.id === id ? { ...item, [channel]: !item[channel] } : item,
      ),
    );
  }

  toggleIntegration(id: string): void {
    this.integrations.update((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              connected: !item.connected,
              lastSync: !item.connected ? 'Sincronizado agora' : null,
            }
          : item,
      ),
    );
  }

  createApiKey(name: string, environment: 'production' | 'sandbox'): ApiKeyItem {
    const randomHex = Math.random().toString(16).substring(2, 6);
    const created: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name,
      prefix: `alc_${environment === 'production' ? 'live' : 'test'}_${randomHex}...9a2f`,
      environment,
      createdAt: 'Hoje',
      lastUsedAt: 'Nunca utilizada',
      scopes: ['requests:read', 'approvals:write'],
    };
    this.apiKeys.update((prev) => [created, ...prev]);
    return created;
  }

  revokeApiKey(id: string): void {
    this.apiKeys.update((prev) => prev.filter((k) => k.id !== id));
  }

  private atualizarTenantAtivo(
    updater: (tenant: SaasClientTenant) => SaasClientTenant,
  ): void {
    const activeId = this.activeTenant().tenantId;
    this.tenants.update((lista) => {
      const atualizada = lista.map((t) => (t.tenantId === activeId ? updater(t) : t));
      salvarTenantsNoStorage(atualizada);
      const atualizado = atualizada.find((t) => t.tenantId === activeId);
      if (atualizado) {
        this.persistirTenantNoBackend(atualizado);
      }
      return atualizada;
    });
  }

  private atualizarOrganizacaoAtiva(
    updater: (org: OrganizationData) => OrganizationData,
  ): void {
    this.atualizarTenantAtivo((t) => ({
      ...t,
      organization: updater(t.organization),
    }));
  }

  private sincronizarPerfilComColaboradorLogado(
    email: string,
    tenantId: string,
    name?: string,
    role?: string,
  ): void {
    const emailLimpo = email.trim().toLowerCase();
    if (emailLimpo === 'dev@alcadas.com' || role === 'SUPER_USER') {
      const tenant = this.activeTenant();
      this.userProfile.update((prev) => ({
        ...prev,
        fullName: 'Desenvolvedor',
        displayName: 'Desenvolvedor',
        email: 'dev@alcadas.com',
        additionalEmails: [{ email: 'dev@alcadas.com', isPrimary: true, verified: true }],
        company: tenant.organization.legalName,
        cnpj: tenant.organization.cnpj,
        jobTitle: 'Desenvolvedor (Super Admin)',
        department: 'Engenharia de Plataforma',
        employeeId: 'DEV-0001',
        roles: ['SUPER_USER', 'Desenvolvedor', 'Admin Geral'],
        approvalLimit: 9999999,
        costCenters: tenant.organization.departments.map((d) => `${d.costCenter} · ${d.name}`),
        recentApprovals: [],
      }));
      return;
    }

    const match = this.findAccountByEmail(emailLimpo);
    if (match) {
      const { tenant, employee, profissao } = match;
      if (tenant.tenantId !== tenantId) {
        this.activeTenantId.set(tenant.tenantId);
      }
      this.userProfile.update((prev) => ({
        ...prev,
        fullName: employee.fullName,
        displayName: employee.fullName.split(' ').slice(0, 2).join(' '),
        email: employee.email,
        additionalEmails: [{ email: employee.email, isPrimary: true, verified: true }],
        phone: employee.phone || prev.phone,
        company: tenant.organization.legalName,
        cnpj: tenant.organization.cnpj,
        jobTitle: employee.jobTitle,
        department: employee.departmentName,
        employeeId: employee.employeeCode,
        roles: [profissao.nome, employee.role],
        approvalLimit: employee.approvalLimit,
        costCenters: [employee.departmentName],
        recentApprovals: [],
      }));
      return;
    }

    const nomeExibicao = name || email.split('@')[0] || 'Usuário';
    this.userProfile.update((prev) => ({
      ...prev,
      fullName: nomeExibicao,
      displayName: nomeExibicao,
      email,
      additionalEmails: [{ email, isPrimary: true, verified: true }],
      roles: [role || 'SOLICITANTE'],
      recentApprovals: [],
    }));
  }
}
