import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  FaixaRegraAlcada,
  validarFaixasRegra,
} from '@alcadas-core/models';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { FirestoreService } from '../database/firestore.service';
import { AlcadasService } from './alcadas.service';
import { ProvisionamentoColaboradoresService } from './provisionamento-colaboradores.service';

const PLATFORM_TENANT_ID = 'platform-saas';
const SAAS_TENANTS_COLLECTION = 'saas_tenants';
const WORKFLOWS_COLLECTION = 'workflows';
const RULES_CATALOG_COLLECTION = 'rules_catalog';

/** Mesmo formato de tenantId aceito pelos guards de autenticação. */
const TENANT_ID_VALIDO = /^[A-Za-z0-9_-]+$/;

/**
 * Campos do cadastro da empresa que pertencem à plataforma (plano contratado, situação e limites).
 * O administrador da empresa não pode alterá-los; só o `SUPER_USER`.
 */
const CAMPOS_DA_PLATAFORMA = ['plan', 'status', 'maxUsers', 'createdAt'] as const;

interface DepartmentPayload {
  id: string;
  code: string;
  name: string;
  costCenter: string;
  monthlyBudget: number;
  managerName: string;
  color: string;
}

interface EmployeePayload {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  role: string;
  departmentId: string;
  departmentName: string;
  approvalLimit: number;
  status: string;
  joinedAt: string;
  password?: string;
  profissaoId?: number;
  isCompanyAdmin?: boolean;
}

interface SaasTenantPayload {
  tenantId: string;
  plan: string;
  status: string;
  createdAt: string;
  maxUsers: number;
  ownerName: string;
  ownerEmail: string;
  ownerRole: string;
  organization: {
    cnpj: string;
    legalName: string;
    tradeName: string;
    stateRegistration: string;
    taxRegime: string;
    corporateEmail: string;
    corporatePhone: string;
    website: string;
    address: Record<string, string>;
    departments: DepartmentPayload[];
    employees: EmployeePayload[];
    policies: Record<string, unknown>;
  };
  profissoes: Array<{
    id: number;
    nome: string;
    systemRole?: string;
    funcionalidades: string[];
  }>;
}

/**
 * Governança multi-tenant (SaaS) e fluxos/regras de alçada da organização.
 *
 * Controle de acesso (Issue #28 / RF01, RF03, RN01, RN02):
 * - todas as rotas exigem token válido (`JwtAuthGuard`) → sem token ou token inválido: 401;
 * - `GET saas/tenants` e `POST saas/tenants/sync` enxergam TODAS as empresas e por isso são
 *   exclusivas do `SUPER_USER` da plataforma → qualquer outro papel: 403;
 * - `PUT saas/tenants/:tenantId` aceita o `SUPER_USER` (qualquer empresa) e o `ADMIN` da própria
 *   empresa, que mantém departamentos e colaboradores na tela de Organização. `ADMIN` apontando
 *   para outra empresa recebe 403 e nunca altera plano, situação ou limites da própria;
 * - `organizacao/fluxos` usa sempre o tenant do token: não há parâmetro que permita ler outra empresa.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SaasController {
  constructor(
    private readonly firestore: FirestoreService,
    private readonly alcadasService: AlcadasService,
    private readonly provisionamento: ProvisionamentoColaboradoresService,
  ) {}

  /**
   * Lista todas as empresas clientes (tenants) persistidas no Firestore.
   * Exclusivo do Super Admin da plataforma: a resposta contém dados de todas as empresas.
   *
   * @example
   * GET /api/saas/tenants   (Authorization: Bearer <token SUPER_USER>) → 200 { items: [...] }
   * GET /api/saas/tenants   (sem token)                                → 401
   * GET /api/saas/tenants   (token de ADMIN/colaborador de empresa)    → 403
   */
  @Get('saas/tenants')
  @Roles('SUPER_USER')
  async listSaasTenants(): Promise<{ items: SaasTenantPayload[] }> {
    const docs = await this.firestore.listTenantCollection<SaasTenantPayload>(
      PLATFORM_TENANT_ID,
      SAAS_TENANTS_COLLECTION,
    );
    return { items: docs };
  }

  /**
   * Cria ou atualiza uma empresa cliente (dados fiscais, departamentos/centros de custo e
   * colaboradores) no Firestore e provisiona os colaboradores no Firebase Auth (#32).
   *
   * @example
   * PUT /api/saas/tenants/startop    (SUPER_USER)                 → 200
   * PUT /api/saas/tenants/startop    (ADMIN da startop)           → 200 (plano/situação preservados)
   * PUT /api/saas/tenants/empresa-b  (ADMIN da startop)           → 403
   * PUT /api/saas/tenants/startop    (SOLICITANTE, APROVADOR...)  → 403
   */
  @Put('saas/tenants/:tenantId')
  @Roles('SUPER_USER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async upsertSaasTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') paramTenantId: string,
    @Body() payload: SaasTenantPayload,
  ): Promise<SaasTenantPayload> {
    const tenantId = paramTenantId || payload?.tenantId;
    if (!tenantId || !TENANT_ID_VALIDO.test(tenantId) || tenantId === PLATFORM_TENANT_ID) {
      throw new BadRequestException('Identificador de empresa (tenantId) inválido.');
    }

    let normalized: SaasTenantPayload = { ...payload, tenantId };

    if (user.role !== 'SUPER_USER') {
      normalized = await this.restringirAoProprioTenant(user, normalized);
    }
    if (process.env['NODE_ENV'] === 'production') {
      normalized = this.removerSenhas(normalized);
    }

    // 1. Grava no registro global SaaS e no escopo isolado do próprio tenant no Firestore
    await this.firestore.setTenantDocument(
      PLATFORM_TENANT_ID,
      SAAS_TENANTS_COLLECTION,
      tenantId,
      normalized,
    );
    await this.firestore.setTenantDocument(
      tenantId,
      'organization',
      'config',
      normalized,
    );

    // 2. Sincroniza cada departamento da empresa como Centro de Custo no Firestore (/tenants/{tenantId}/cost_centers)
    const departments = normalized.organization?.departments ?? [];
    for (const dept of departments) {
      await this.firestore.setTenantDocument(tenantId, 'cost_centers', dept.id, {
        id: dept.id,
        tenantId,
        code: dept.costCenter || dept.code,
        name: dept.name,
        monthlyBudget: Number(dept.monthlyBudget ?? 100000),
        department: dept.name,
        managerName: dept.managerName,
        color: dept.color,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Garante que o tenant tenha faixas de alçada N1, N2 e N3 no Firestore
    const existingTiers = await this.alcadasService.getApprovalTiers(tenantId);
    if (existingTiers.length === 0) {
      await this.alcadasService.upsertApprovalTiers(tenantId, {
        tiers: [
          { level: 'N1', approverRole: 'APROVADOR_N1', minAmount: 0, maxAmount: 15000 },
          { level: 'N2', approverRole: 'APROVADOR_N2', minAmount: 15000.01, maxAmount: 75000 },
          {
            level: 'N3',
            approverRole: 'DIRETOR_CFO',
            minAmount: 75000.01,
            maxAmount: null,
            unlimited: true,
          },
        ],
      });
    }

    // 4. Provisiona os colaboradores no Firebase Auth com as claims de empresa e papel (#32).
    //    Roda em segundo plano: o serviço nunca lança e não atrasa a resposta do cadastro.
    //    As senhas (só usadas no emulador) vêm do payload original, não do documento persistido.
    void this.provisionamento.sincronizar(
      tenantId,
      payload?.organization?.employees ?? [],
      departments,
    );

    return normalized;
  }

  /**
   * Sincroniza um lote de tenants de uma vez (seed inicial ou sincronização completa).
   * Exclusivo do Super Admin da plataforma.
   */
  @Post('saas/tenants/sync')
  @Roles('SUPER_USER')
  @HttpCode(HttpStatus.OK)
  async syncAllTenants(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { tenants: SaasTenantPayload[] },
  ): Promise<{ synced: number }> {
    const list = Array.isArray(body?.tenants) ? body.tenants : [];
    let synced = 0;
    for (const t of list) {
      if (t?.tenantId) {
        await this.upsertSaasTenant(user, t.tenantId, t);
        synced++;
      }
    }
    return { synced };
  }

  /**
   * Isolamento multi-tenant para quem não é `SUPER_USER`: o administrador só altera a PRÓPRIA
   * empresa, ela precisa já existir (quem cria empresas é a plataforma) e os campos comerciais
   * (`plan`, `status`, `maxUsers`, `createdAt`) são sempre os já gravados, não os do payload.
   */
  private async restringirAoProprioTenant(
    user: AuthenticatedUser,
    payload: SaasTenantPayload,
  ): Promise<SaasTenantPayload> {
    if (user.tenantId !== payload.tenantId) {
      throw new ForbiddenException(
        'RBAC: Acesso negado. Não é permitido alterar os dados de outra empresa.',
      );
    }
    const atual = await this.firestore.getTenantDocument<SaasTenantPayload>(
      PLATFORM_TENANT_ID,
      SAAS_TENANTS_COLLECTION,
      payload.tenantId,
    );
    if (!atual) {
      throw new NotFoundException('Empresa não cadastrada na plataforma.');
    }
    const protegido: SaasTenantPayload = { ...payload };
    for (const campo of CAMPOS_DA_PLATAFORMA) {
      (protegido as unknown as Record<string, unknown>)[campo] = atual[campo];
    }
    return protegido;
  }

  /** Em produção nenhuma senha de colaborador é persistida no Firestore nem devolvida (RNF09). */
  private removerSenhas(payload: SaasTenantPayload): SaasTenantPayload {
    const employees = payload.organization?.employees;
    if (!Array.isArray(employees)) {
      return payload;
    }
    return {
      ...payload,
      organization: {
        ...payload.organization,
        employees: employees.map((colaborador) => {
          const semSenha = { ...colaborador };
          delete semSenha.password;
          return semSenha;
        }),
      },
    };
  }

  // ===========================================================================
  // FLUXOS E REGRAS DE ALÇADA SINCRONIZADOS NO FIRESTORE POR TENANT
  // ===========================================================================

  @Get('organizacao/fluxos')
  async getTenantWorkflowsAndRules(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    workflows: Record<string, unknown>[];
    rulesCatalog: Record<string, unknown>[];
  }> {
    const tenantId = user.tenantId || 'startop';
    const workflows = await this.firestore.listTenantCollection<Record<string, unknown>>(
      tenantId,
      WORKFLOWS_COLLECTION,
    );
    const rulesCatalog = await this.firestore.listTenantCollection<Record<string, unknown>>(
      tenantId,
      RULES_CATALOG_COLLECTION,
    );
    return { workflows, rulesCatalog };
  }

  @Put('organizacao/fluxos')
  @HttpCode(HttpStatus.OK)
  async saveTenantWorkflowsAndRules(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      workflows?: Array<Record<string, unknown> & { id?: string }>;
      rulesCatalog?: Array<Record<string, unknown> & { id?: string }>;
    },
  ): Promise<{ savedWorkflows: number; savedRules: number }> {
    const tenantId = user.tenantId || 'startop';
    let savedWorkflows = 0;
    let savedRules = 0;

    // Valida todas as regras com faixas de valor antes de persistir qualquer documento (#69)
    if (Array.isArray(body.rulesCatalog)) {
      this.assertRulesCatalogValid(body.rulesCatalog);
    }

    if (Array.isArray(body.workflows)) {
      for (const wf of body.workflows) {
        const id = String(wf.id || `wf-${Date.now()}`);
        await this.firestore.setTenantDocument(tenantId, WORKFLOWS_COLLECTION, id, wf);
        savedWorkflows++;
      }
    }

    if (Array.isArray(body.rulesCatalog)) {
      for (const rule of body.rulesCatalog) {
        const id = String(rule.id || `rule-${Date.now()}`);
        await this.firestore.setTenantDocument(tenantId, RULES_CATALOG_COLLECTION, id, rule);
        savedRules++;
      }
    }

    return { savedWorkflows, savedRules };
  }

  /**
   * Regras criadas pelo construtor (com `faixas`) precisam ter nome e faixas de valor
   * coerentes (mínimo < máximo, sem sobreposição, aprovador definido). Regras legadas
   * sem `faixas` continuam aceitas como antes.
   */
  private assertRulesCatalogValid(rules: Array<Record<string, unknown>>): void {
    rules.forEach((rule, posicao) => {
      if (!('faixas' in rule)) return;

      const nome = typeof rule['name'] === 'string' ? rule['name'].trim() : '';
      if (!nome) {
        throw new BadRequestException(`Regra #${posicao + 1}: o nome da regra é obrigatório.`);
      }

      const erros = validarFaixasRegra(rule['faixas'] as FaixaRegraAlcada[]);
      if (erros.length > 0) {
        const detalhes = erros
          .map((e) => (e.indice === null ? e.mensagem : `Faixa ${e.indice + 1}: ${e.mensagem}`))
          .join(' ');
        throw new BadRequestException(`Regra "${nome}": ${detalhes}`);
      }
    });
  }
}
