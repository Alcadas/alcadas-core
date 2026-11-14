import {
  BadRequestException,
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
import {
  AuthenticatedUser,
  FaixaRegraAlcada,
  validarFaixasRegra,
} from '@alcadas-core/models';
import { CurrentUser } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FirestoreService } from '../database/firestore.service';
import { AlcadasService } from './alcadas.service';
import { ProvisionamentoColaboradoresService } from './provisionamento-colaboradores.service';

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

@Controller()
@UseGuards(JwtAuthGuard)
export class SaasController {
  constructor(
    private readonly firestore: FirestoreService,
    private readonly alcadasService: AlcadasService,
    private readonly provisionamento: ProvisionamentoColaboradoresService,
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
   * Cria ou atualiza uma empresa cliente (dados fiscais, departamentos/centros de custo e
   * colaboradores) no Firestore e provisiona os colaboradores no Firebase Auth (#32).
   */
  @Put('saas/tenants/:tenantId')
  @HttpCode(HttpStatus.OK)
  async upsertSaasTenant(
    @Param('tenantId') paramTenantId: string,
    @Body() payload: SaasTenantPayload,
  ): Promise<SaasTenantPayload> {
    const tenantId = paramTenantId || payload.tenantId;
    let normalized: SaasTenantPayload = {
      ...payload,
      tenantId,
    };
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
}
