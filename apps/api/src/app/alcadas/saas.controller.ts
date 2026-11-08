import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { AuthenticatedUser } from '@alcadas-core/models';
import { CurrentUser } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FirestoreService } from '../database/firestore.service';
import { getFirebaseApp } from '../firebase/firebase-app';
import { AlcadasService } from './alcadas.service';

const PLATFORM_TENANT_ID = 'platform-saas';
const SAAS_TENANTS_COLLECTION = 'saas_tenants';
const WORKFLOWS_COLLECTION = 'workflows';
const RULES_CATALOG_COLLECTION = 'rules_catalog';

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

function mapRoleToClaim(role: string): string {
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

@Controller()
@UseGuards(JwtAuthGuard)
export class SaasController {
  constructor(
    private readonly firestore: FirestoreService,
    private readonly alcadasService: AlcadasService,
  ) {}

  /**
   * Lista todas as empresas clientes (tenants) persistidas no Firestore.
   */
  @Get('saas/tenants')
  async listSaasTenants(): Promise<{ items: SaasTenantPayload[] }> {
    const docs = await this.firestore.listTenantCollection<SaasTenantPayload>(
      PLATFORM_TENANT_ID,
      SAAS_TENANTS_COLLECTION,
    );
    return { items: docs };
  }

  /**
   * Sincroniza uma empresa cliente (dados fiscais, departamentos/centros de custo, funcionários e delegações)
   * diretamente no Firestore Emulator e no Firebase Auth Emulator.
   */
  @Put('saas/tenants/:tenantId')
  @HttpCode(HttpStatus.OK)
  async upsertSaasTenant(
    @Param('tenantId') paramTenantId: string,
    @Body() payload: SaasTenantPayload,
  ): Promise<SaasTenantPayload> {
    const tenantId = paramTenantId || payload.tenantId;
    const normalized: SaasTenantPayload = {
      ...payload,
      tenantId,
    };

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

    // 4. Sincroniza contas dos colaboradores/clientes no Firebase Auth Emulator (quando disponível)
    void this.syncEmployeesWithFirebaseAuth(tenantId, normalized.organization?.employees ?? []);

    return normalized;
  }

  /**
   * Sincroniza um lote de tenants de uma vez (seed inicial ou sincronização completa).
   */
  @Post('saas/tenants/sync')
  @HttpCode(HttpStatus.OK)
  async syncAllTenants(
    @Body() body: { tenants: SaasTenantPayload[] },
  ): Promise<{ synced: number }> {
    const list = Array.isArray(body?.tenants) ? body.tenants : [];
    for (const t of list) {
      if (t?.tenantId) {
        await this.upsertSaasTenant(t.tenantId, t);
      }
    }
    return { synced: list.length };
  }

  // ===========================================================================
  // FLUXOS E REGRAS DE ALÇADA SINCRONIZADOS NO FIRESTORE POR TENANT
  // ===========================================================================

  @Get('organizacao/fluxos')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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

  private async syncEmployeesWithFirebaseAuth(
    tenantId: string,
    employees: EmployeePayload[],
  ): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') return;
    try {
      const auth = getAuth(getFirebaseApp());
      for (const emp of employees) {
        if (!emp.email) continue;
        const email = emp.email.trim().toLowerCase();
        const password = emp.password && emp.password.length >= 6 ? emp.password : '123456';
        const roleClaim = mapRoleToClaim(emp.role);
        const claims = {
          tenantId,
          role: roleClaim,
          roles: [roleClaim],
          name: emp.fullName,
        };

        try {
          const existing = await auth.getUserByEmail(email);
          await auth.updateUser(existing.uid, {
            displayName: emp.fullName,
            password,
            disabled: emp.status === 'INATIVO',
          });
          await auth.setCustomUserClaims(existing.uid, claims);
        } catch {
          const created = await auth.createUser({
            uid: `${tenantId}-${emp.id}`,
            email,
            password,
            displayName: emp.fullName,
            emailVerified: true,
            disabled: emp.status === 'INATIVO',
          });
          await auth.setCustomUserClaims(created.uid, claims);
        }
      }
    } catch {
      // Ignora silenciosamente se o Auth Emulator estiver indisponível
    }
  }
}
