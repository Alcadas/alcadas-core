import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApprovalTier,
  ApprovalTierInputDto,
  AuthenticatedUser,
  CostCenter,
  CreateCostCenterDto,
  EvaluateTierCompetenceDto,
  EvaluateTierCompetenceResponseDto,
  UpsertApprovalMatrixDto,
} from '@alcadas-core/models';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AlcadasService } from './alcadas.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlcadasController {
  constructor(private readonly alcadasService: AlcadasService) {}

  // ===========================================================================
  // 1. Centros de Custo (/api/centros-custo e /api/tenants/:tenantId/cost-centers)
  // ===========================================================================

  @Post('centros-custo')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createCostCenter(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCostCenterDto,
  ): Promise<CostCenter> {
    const tenantId = this.alcadasService.assertTenantIsolation(user);
    return this.alcadasService.createCostCenter(tenantId, dto);
  }

  @Get('centros-custo')
  async listCostCenters(@CurrentUser() user: AuthenticatedUser): Promise<CostCenter[]> {
    const tenantId = this.alcadasService.assertTenantIsolation(user);
    return this.alcadasService.listCostCenters(tenantId);
  }

  @Post('tenants/:tenantId/cost-centers')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createTenantCostCenter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') paramTenantId: string,
    @Body() dto: CreateCostCenterDto,
  ): Promise<CostCenter> {
    const tenantId = this.alcadasService.assertTenantIsolation(user, paramTenantId);
    return this.alcadasService.createCostCenter(tenantId, dto);
  }

  @Get('tenants/:tenantId/cost-centers')
  async listTenantCostCenters(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') paramTenantId: string,
  ): Promise<CostCenter[]> {
    const tenantId = this.alcadasService.assertTenantIsolation(user, paramTenantId);
    return this.alcadasService.listCostCenters(tenantId);
  }

  // ===========================================================================
  // 2. Tetos e Faixas de Alçada (N1, N2, N3) (/api/alcadas/tetos e /api/tenants/:tenantId/tiers)
  // ===========================================================================

  @Put('alcadas/tetos')
  @Roles('ADMIN')
  async upsertApprovalTiers(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpsertApprovalMatrixDto | ApprovalTierInputDto,
  ): Promise<ApprovalTier[]> {
    const tenantId = this.alcadasService.assertTenantIsolation(user);
    return this.alcadasService.upsertApprovalTiers(tenantId, body);
  }

  @Post('alcadas/tetos')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async postApprovalTiers(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpsertApprovalMatrixDto | ApprovalTierInputDto,
  ): Promise<ApprovalTier[]> {
    const tenantId = this.alcadasService.assertTenantIsolation(user);
    return this.alcadasService.upsertApprovalTiers(tenantId, body);
  }

  @Get('alcadas/tetos')
  async getApprovalTiers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('costCenterId') costCenterId?: string,
  ): Promise<ApprovalTier[]> {
    const tenantId = this.alcadasService.assertTenantIsolation(user);
    return this.alcadasService.getApprovalTiers(tenantId, costCenterId);
  }

  @Put('tenants/:tenantId/tiers')
  @Roles('ADMIN')
  async upsertTenantTiers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') paramTenantId: string,
    @Body() body: UpsertApprovalMatrixDto | ApprovalTierInputDto,
  ): Promise<ApprovalTier[]> {
    const tenantId = this.alcadasService.assertTenantIsolation(user, paramTenantId);
    return this.alcadasService.upsertApprovalTiers(tenantId, body);
  }

  @Get('tenants/:tenantId/tiers')
  async getTenantTiers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') paramTenantId: string,
    @Query('costCenterId') costCenterId?: string,
  ): Promise<ApprovalTier[]> {
    const tenantId = this.alcadasService.assertTenantIsolation(user, paramTenantId);
    return this.alcadasService.getApprovalTiers(tenantId, costCenterId);
  }

  // ===========================================================================
  // 3. Verificação de Competência Decisória por Teto de Alçada (CA-01.2)
  // ===========================================================================

  @Post('alcadas/validar-decisao')
  @HttpCode(HttpStatus.OK)
  async evaluateDecisionCompetence(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EvaluateTierCompetenceDto,
  ): Promise<EvaluateTierCompetenceResponseDto> {
    this.alcadasService.assertTenantIsolation(user);
    return this.alcadasService.evaluateDecisionCompetence(user, dto);
  }
}
