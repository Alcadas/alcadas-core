import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ApprovalLevel,
  ApprovalTier,
  ApprovalTierInputDto,
  AuthenticatedUser,
  CostCenter,
  CreateCostCenterDto,
  EvaluateTierCompetenceDto,
  EvaluateTierCompetenceResponseDto,
  UpsertApprovalMatrixDto,
  UserRole,
} from '@alcadas-core/models';
import { FirestoreService } from '../database/firestore.service';

const COST_CENTERS_COLLECTION = 'cost_centers';
const APPROVAL_TIERS_COLLECTION = 'approval_tiers';

const DEFAULT_ROLE_BY_LEVEL: Record<ApprovalLevel, { role: UserRole; title: string }> = {
  N1: { role: 'APROVADOR_N1', title: 'Coordenador / Supervisor de Setor' },
  N2: { role: 'APROVADOR_N2', title: 'Gerente de Departamento' },
  N3: { role: 'DIRETOR_CFO', title: 'Diretoria Executiva / CFO' },
};

@Injectable()
export class AlcadasService {
  constructor(private readonly firestore: FirestoreService) {}

  /**
   * Valida que o tenant solicitado no path (quando presente) pertence ao usuário autenticado (RNF07).
   */
  assertTenantIsolation(user: AuthenticatedUser, targetTenantId?: string): string {
    if (!user || !user.tenantId) {
      throw new ForbiddenException('Isolamento de Tenant (RNF07): tenantId não identificado.');
    }
    if (targetTenantId && targetTenantId !== user.tenantId) {
      throw new ForbiddenException(
        'Isolamento de Tenant (RNF07): Acesso cruzado proibido para outra organização.',
      );
    }
    return user.tenantId;
  }

  /**
   * Cadastra um novo Centro de Custo dentro do tenant do Administrador (RF01 / US-01 / CA-01.3).
   */
  async createCostCenter(
    tenantId: string,
    dto: CreateCostCenterDto,
  ): Promise<CostCenter> {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException('Dados do centro de custo são obrigatórios.');
    }

    const rawName = (dto.name ?? dto.nome ?? '').trim();
    if (!rawName) {
      throw new BadRequestException(
        'O nome do centro de custo é obrigatório (ex.: "Clínica Centro").',
      );
    }

    const rawCode = (dto.code ?? dto.codigo ?? this.generateCostCenterCode(rawName)).trim();
    if (!rawCode) {
      throw new BadRequestException('O código do centro de custo é obrigatório.');
    }

    const budget = dto.monthlyBudget ?? dto.orcamentoMensal;
    if (budget !== undefined && budget !== null) {
      if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) {
        throw new BadRequestException(
          'O orçamento mensal do centro de custo deve ser um valor numérico maior que zero.',
        );
      }
      this.assertTwoDecimalPlaces(budget, 'orçamento mensal');
    }

    const now = new Date().toISOString();
    const id = `cc-${randomUUID().slice(0, 8)}`;

    const costCenter: CostCenter = {
      id,
      tenantId,
      code: rawCode.toUpperCase(),
      name: rawName,
      ...(budget !== undefined && budget !== null ? { monthlyBudget: budget } : {}),
      isActive: dto.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.firestore.setTenantDocument(
      tenantId,
      COST_CENTERS_COLLECTION,
      id,
      costCenter,
    );

    return costCenter;
  }

  /**
   * Lista todos os Centros de Custo cadastrados no tenant do usuário autenticado (CA-01.3 / RNF07).
   */
  async listCostCenters(tenantId: string): Promise<CostCenter[]> {
    const items = await this.firestore.listTenantCollection<CostCenter>(
      tenantId,
      COST_CENTERS_COLLECTION,
    );
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Configura os tetos financeiros de aprovação por nível (N1, N2, N3) no tenant do Administrador.
   * Aplica validação atômica prévia: se qualquer nível possuir teto vazio, 0 ou negativo,
   * recusa com HTTP 400 Bad Request e 0 faixas são persistidas (CA-01.1).
   */
  async upsertApprovalTiers(
    tenantId: string,
    payload: UpsertApprovalMatrixDto | ApprovalTierInputDto,
  ): Promise<ApprovalTier[]> {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException(
        'CA-01.1: Os dados de configuração das faixas de alçada são obrigatórios.',
      );
    }

    const normalizedInputs = this.extractTierInputs(payload);
    if (normalizedInputs.length === 0) {
      throw new BadRequestException(
        'CA-01.1: Informe ao menos uma faixa de alçada (N1, N2 ou N3) com teto válido.',
      );
    }

    const costCenterId =
      ('costCenterId' in payload ? payload.costCenterId : undefined) ??
      ('centroCustoId' in payload ? payload.centroCustoId : undefined) ??
      null;

    // 1. Valida TODAS as faixas em memória antes de persistir qualquer registro (CA-01.1: 0 faixas inválidas persistidas)
    const now = new Date().toISOString();
    const validatedByLevel = new Map<ApprovalLevel, ApprovalTier>();

    for (const input of normalizedInputs) {
      const level = this.validateLevel(input.level ?? input.nivel);
      const { maxAmount, unlimited } = this.validateTierCeiling(level, input);

      const defaultMeta = DEFAULT_ROLE_BY_LEVEL[level];
      const approverRole = input.approverRole ?? defaultMeta.role;
      const roleTitle = input.cargo?.trim() || defaultMeta.title;
      const scopeSuffix = costCenterId ? `${costCenterId}-${level}` : level;

      const tier: ApprovalTier = {
        id: `tier-${scopeSuffix.toLowerCase()}`,
        tenantId,
        costCenterId,
        level,
        approverRole,
        roleTitle,
        minAmount: 0.01,
        maxAmount,
        unlimited,
        requiredApprovals: input.requiredApprovals ?? 1,
        updatedAt: now,
      };

      validatedByLevel.set(level, tier);
    }

    // 2. Mescla com as faixas já existentes do tenant para calcular minAmount e validar a progressão N1 < N2 < N3
    const existingTiers = await this.getApprovalTiers(tenantId, costCenterId);
    const mergedByLevel = new Map<ApprovalLevel, ApprovalTier>();

    for (const existing of existingTiers) {
      mergedByLevel.set(existing.level, existing);
    }
    for (const [lvl, updated] of validatedByLevel.entries()) {
      mergedByLevel.set(lvl, updated);
    }

    const n1 = mergedByLevel.get('N1');
    const n2 = mergedByLevel.get('N2');
    const n3 = mergedByLevel.get('N3');

    if (n1 && n2 && n1.maxAmount !== null && n2.maxAmount !== null) {
      if (n2.maxAmount <= n1.maxAmount) {
        throw new BadRequestException(
          `RN01: O teto do nível N2 (R$ ${n2.maxAmount.toFixed(2)}) deve ser superior ao teto do nível N1 (R$ ${n1.maxAmount.toFixed(2)}).`,
        );
      }
    }

    if (n2 && n3 && n2.maxAmount !== null && n3.maxAmount !== null) {
      if (n3.maxAmount <= n2.maxAmount) {
        throw new BadRequestException(
          `RN01: O teto do nível N3 (R$ ${n3.maxAmount.toFixed(2)}) deve ser superior ao teto do nível N2 (R$ ${n2.maxAmount.toFixed(2)}).`,
        );
      }
    }

    // Ajusta os pisos (minAmount) contíguos da matriz (ex.: N1: 0.01..1000, N2: 1000.01..5000, N3: 5000.01..sem limite)
    if (n1) {
      n1.minAmount = 0.01;
    }
    if (n2) {
      n2.minAmount = n1 && n1.maxAmount !== null ? Number((n1.maxAmount + 0.01).toFixed(2)) : 0.01;
    }
    if (n3) {
      const previousMax = n2?.maxAmount ?? n1?.maxAmount ?? null;
      n3.minAmount = previousMax !== null ? Number((previousMax + 0.01).toFixed(2)) : 0.01;
    }

    // 3. Persiste no emulador do Firestore apenas após 100% das validações terem passado
    const tiersToSave = Array.from(validatedByLevel.values()).map(
      (t) => mergedByLevel.get(t.level) ?? t,
    );

    for (const tier of tiersToSave) {
      await this.firestore.setTenantDocument(
        tenantId,
        APPROVAL_TIERS_COLLECTION,
        tier.id,
        tier,
      );
    }

    return this.getApprovalTiers(tenantId, costCenterId);
  }

  /**
   * Lê as faixas de alçada do tenant diretamente do emulador do Firestore.
   */
  async getApprovalTiers(
    tenantId: string,
    costCenterId?: string | null,
  ): Promise<ApprovalTier[]> {
    const allTiers = await this.firestore.listTenantCollection<ApprovalTier>(
      tenantId,
      APPROVAL_TIERS_COLLECTION,
    );

    const filtered = allTiers.filter((t) =>
      costCenterId ? t.costCenterId === costCenterId : !t.costCenterId,
    );

    const order: Record<ApprovalLevel, number> = { N1: 1, N2: 2, N3: 3 };
    return filtered.sort((a, b) => (order[a.level] ?? 99) - (order[b.level] ?? 99));
  }

  /**
   * Verifica se um aprovador tem competência de alçada para decidir um pedido de determinado valor (CA-01.2).
   * Se o valor ultrapassar o teto do cargo do aprovador (ex.: R$ 5.000,01 para Gerente com teto de R$ 5.000,00),
   * lança HTTP 403 Forbidden e indica o nível superior responsável.
   */
  async evaluateDecisionCompetence(
    user: AuthenticatedUser,
    dto: EvaluateTierCompetenceDto,
  ): Promise<EvaluateTierCompetenceResponseDto> {
    const rawAmount = dto?.amount ?? dto?.valor;
    if (
      rawAmount === undefined ||
      rawAmount === null ||
      typeof rawAmount !== 'number' ||
      !Number.isFinite(rawAmount) ||
      rawAmount <= 0
    ) {
      throw new BadRequestException(
        'O valor da solicitação deve ser um número positivo maior que zero.',
      );
    }
    this.assertTwoDecimalPlaces(rawAmount, 'valor da solicitação');

    const costCenterId = dto.costCenterId ?? dto.centroCustoId ?? null;
    let tiers = await this.getApprovalTiers(user.tenantId, costCenterId);

    if (tiers.length === 0 && costCenterId) {
      tiers = await this.getApprovalTiers(user.tenantId, null);
    }

    // Caso o tenant ainda não tenha parametrizado, utiliza a matriz padrão Startop LTDA (N1=1000, N2=5000, N3=sem limite)
    if (tiers.length === 0) {
      tiers = this.getDefaultStartopTiers(user.tenantId);
    }

    const actorLevel = this.resolveActorLevel(user, dto);
    const actorTier = tiers.find((t) => t.level === actorLevel);

    if (!actorTier) {
      throw new ForbiddenException(
        `CA-01.2: O nível/cargo (${actorLevel}) não possui faixa de alçada habilitada para aprovar solicitações.`,
      );
    }

    const requiredTier = this.findRequiredTierForAmount(tiers, rawAmount);

    const exceedsActorCeiling =
      !actorTier.unlimited &&
      actorTier.maxAmount !== null &&
      rawAmount > actorTier.maxAmount;

    if (exceedsActorCeiling) {
      const formattedAmount = rawAmount.toFixed(2);
      const formattedCeiling = actorTier.maxAmount?.toFixed(2) ?? '0.00';
      throw new ForbiddenException(
        `CA-01.2: Valor do pedido (R$ ${formattedAmount}) excede o teto de alçada configurado para ${actorTier.roleTitle} (${actorLevel}: R$ ${formattedCeiling}). O pedido foi escalonado para o nível superior (${requiredTier.level} - ${requiredTier.roleTitle}).`,
      );
    }

    return {
      allowed: true,
      amount: rawAmount,
      actorLevel,
      actorMaxAmount: actorTier.maxAmount,
      requiredLevel: requiredTier.level,
      requiredRole: requiredTier.approverRole,
      escalated: requiredTier.level !== 'N1',
      message: `Aprovação permitida dentro da alçada ${actorLevel} (${actorTier.roleTitle}).`,
    };
  }

  private extractTierInputs(
    payload: UpsertApprovalMatrixDto | ApprovalTierInputDto,
  ): ApprovalTierInputDto[] {
    if ('tiers' in payload && Array.isArray(payload.tiers)) {
      return payload.tiers;
    }

    const matrixPayload = payload as UpsertApprovalMatrixDto;
    const shorthandLevels: ApprovalLevel[] = ['N1', 'N2', 'N3'];
    const extracted: ApprovalTierInputDto[] = [];

    for (const lvl of shorthandLevels) {
      if (lvl in matrixPayload) {
        const raw = matrixPayload[lvl];
        if (raw === null || raw === undefined) {
          extracted.push({
            level: lvl,
            maxAmount: null,
            unlimited: lvl === 'N3' && raw === null,
          });
        } else if (typeof raw === 'number') {
          extracted.push({
            level: lvl,
            maxAmount: raw,
            unlimited: false,
          });
        } else if (typeof raw === 'object') {
          extracted.push({
            ...raw,
            level: lvl,
          });
        } else {
          // Valor inválido (ex.: string vazia "") -> será barrado pela validação de teto
          extracted.push({
            level: lvl,
            maxAmount: Number.NaN,
          });
        }
      }
    }

    if (extracted.length > 0) {
      return extracted;
    }

    if ('level' in payload || 'nivel' in payload) {
      return [payload as ApprovalTierInputDto];
    }

    return [];
  }

  private validateLevel(rawLevel?: string): ApprovalLevel {
    const normalized = (rawLevel ?? '').trim().toUpperCase();
    if (normalized === 'N1' || normalized === 'N2' || normalized === 'N3') {
      return normalized;
    }
    throw new BadRequestException(
      `CA-01.1: Nível de alçada inválido ("${rawLevel ?? ''}"). Os níveis permitidos são N1, N2 ou N3.`,
    );
  }

  /**
   * Valida o teto financeiro conforme CA-01.1:
   * - Salvar uma faixa de alçada com teto vazio, 0 ou negativo é recusado com erro 400 em 100% dos casos.
   * - Apenas N3 pode ser configurado como "sem limite" (unlimited: true / semLimite: true / maxAmount: null explícito sem valor inválido).
   */
  private validateTierCeiling(
    level: ApprovalLevel,
    input: ApprovalTierInputDto,
  ): { maxAmount: number | null; unlimited: boolean } {
    const isExplicitUnlimited =
      input.unlimited === true ||
      input.semLimite === true ||
      (level === 'N3' &&
        (input.maxAmount === null || input.teto === null) &&
        input.maxAmount !== undefined &&
        input.teto === undefined) ||
      (level === 'N3' && input.teto === null && input.maxAmount === undefined);

    const rawCeiling = input.maxAmount !== undefined ? input.maxAmount : input.teto;

    // Se enviou um número em qualquer nível (inclusive N3), ele jamais pode ser <= 0 ou NaN
    if (rawCeiling !== undefined && rawCeiling !== null) {
      if (typeof rawCeiling !== 'number' || !Number.isFinite(rawCeiling) || rawCeiling <= 0) {
        throw new BadRequestException(
          `CA-01.1: Teto financeiro inválido para o nível ${level}. O teto não pode ser vazio, zero ou negativo.`,
        );
      }
      this.assertTwoDecimalPlaces(rawCeiling, `teto do nível ${level}`);
      return { maxAmount: rawCeiling, unlimited: false };
    }

    // Se não enviou número positivo: apenas N3 aceita "sem limite"
    if (level === 'N3' && isExplicitUnlimited) {
      return { maxAmount: null, unlimited: true };
    }

    throw new BadRequestException(
      `CA-01.1: O teto financeiro do nível ${level} não pode ser vazio, zero ou negativo.`,
    );
  }

  private resolveActorLevel(
    user: AuthenticatedUser,
    dto: EvaluateTierCompetenceDto,
  ): ApprovalLevel {
    const explicitLevel = (dto.level ?? dto.nivel)?.trim().toUpperCase();
    if (explicitLevel === 'N1' || explicitLevel === 'N2' || explicitLevel === 'N3') {
      return explicitLevel;
    }

    const rawRole = (dto.role ?? dto.cargo ?? user.role ?? '').trim().toUpperCase();
    if (rawRole === 'N1' || rawRole === 'APROVADOR_N1' || rawRole === 'COORDENADOR' || rawRole === 'SUPERVISOR') {
      return 'N1';
    }
    if (rawRole === 'N2' || rawRole === 'APROVADOR_N2' || rawRole === 'GERENTE' || rawRole === 'USER_NORMAL') {
      return 'N2';
    }
    if (rawRole === 'N3' || rawRole === 'DIRETOR_CFO' || rawRole === 'DIRETOR' || rawRole === 'CFO' || rawRole === 'SUPER_USER') {
      return 'N3';
    }

    if (user.level) {
      return user.level;
    }

    throw new ForbiddenException(
      `O papel ${user.role} não possui alçada de aprovação de solicitações financeiras.`,
    );
  }

  private findRequiredTierForAmount(
    tiers: ApprovalTier[],
    amount: number,
  ): ApprovalTier {
    for (const tier of tiers) {
      if (tier.unlimited || tier.maxAmount === null) {
        return tier;
      }
      if (amount <= tier.maxAmount) {
        return tier;
      }
    }
    return {
      id: 'tier-n3',
      tenantId: tiers[0]?.tenantId ?? 'default',
      level: 'N3',
      approverRole: 'DIRETOR_CFO',
      roleTitle: DEFAULT_ROLE_BY_LEVEL.N3.title,
      minAmount: 5000.01,
      maxAmount: null,
      unlimited: true,
      requiredApprovals: 1,
      updatedAt: new Date().toISOString(),
    };
  }

  private getDefaultStartopTiers(tenantId: string): ApprovalTier[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'tier-n1',
        tenantId,
        level: 'N1',
        approverRole: 'APROVADOR_N1',
        roleTitle: DEFAULT_ROLE_BY_LEVEL.N1.title,
        minAmount: 0.01,
        maxAmount: 1000.0,
        unlimited: false,
        requiredApprovals: 1,
        updatedAt: now,
      },
      {
        id: 'tier-n2',
        tenantId,
        level: 'N2',
        approverRole: 'APROVADOR_N2',
        roleTitle: DEFAULT_ROLE_BY_LEVEL.N2.title,
        minAmount: 1000.01,
        maxAmount: 5000.0,
        unlimited: false,
        requiredApprovals: 1,
        updatedAt: now,
      },
      {
        id: 'tier-n3',
        tenantId,
        level: 'N3',
        approverRole: 'DIRETOR_CFO',
        roleTitle: DEFAULT_ROLE_BY_LEVEL.N3.title,
        minAmount: 5000.01,
        maxAmount: null,
        unlimited: true,
        requiredApprovals: 1,
        updatedAt: now,
      },
    ];
  }

  private generateCostCenterCode(name: string): string {
    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toUpperCase();
    return `CC-${normalized.slice(0, 12) || 'GERAL'}`;
  }

  private assertTwoDecimalPlaces(value: number, fieldLabel: string): void {
    const multiplied = Math.round(value * 100) / 100;
    if (Math.abs(value - multiplied) > 1e-6) {
      throw new BadRequestException(
        `O campo ${fieldLabel} deve possuir no máximo 2 casas decimais.`,
      );
    }
  }
}
