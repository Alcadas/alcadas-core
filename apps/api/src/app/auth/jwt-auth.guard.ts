import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { ApprovalLevel, AuthenticatedUser, UserRole } from '@alcadas-core/models';
import { getFirebaseApp } from '../firebase/firebase-app';

const VALID_ROLES: Set<string> = new Set([
  'SOLICITANTE',
  'APROVADOR_N1',
  'APROVADOR_N2',
  'DIRETOR_CFO',
  'USER_NORMAL',
  'SUPER_USER',
  'AUDITOR',
  'ADMIN',
]);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthenticatedUser;
    }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente ou formato inválido.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Token de autenticação vazio.');
    }

    const user = await this.parseToken(token, request.headers);
    request.user = user;
    return true;
  }

  private async parseToken(
    token: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<AuthenticatedUser> {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const isTest = process.env['NODE_ENV'] === 'test';

    // Em produção (RNF09, ADR-011):
    // 1. OBRIGATÓRIA a validação de assinatura criptográfica real via Firebase Admin SDK (verifyIdToken).
    // 2. Tokens mock, "test:" e sem assinatura são sumariamente recusados com 401.
    // 3. Cabeçalhos como x-user-role e x-approval-limit são rigorosamente IGNORADOS para privilégios.
    if (isProduction) {
      return this.verifyWithFirebaseAdmin(token);
    }

    // Se NODE_ENV === 'test' e o token usa o prefixo estruturado "test:":
    if (isTest && token.startsWith('test:')) {
      return this.parseTokenDeTeste(token, headers);
    }

    // Tenta verificação criptográfica real primeiro (funciona no Emulador ou com credenciais):
    try {
      return await this.verifyWithFirebaseAdmin(token);
    } catch {
      // Em ambientes de teste e desenvolvimento offline, permite fallback local controlado:
      return this.parseFallbackNaoProducao(token, headers);
    }
  }

  private async verifyWithFirebaseAdmin(token: string): Promise<AuthenticatedUser> {
    try {
      const decoded = await getAuth(getFirebaseApp()).verifyIdToken(token);

      const tenantId =
        (decoded['tenantId'] as string) ||
        (decoded['tenant_id'] as string);

      const userId = decoded.uid || (decoded['user_id'] as string) || (decoded['sub'] as string);

      if (!userId || !tenantId) {
        throw new UnauthorizedException(
          'Token JWT inválido: userId e tenantId são obrigatórios nas claims do token.',
        );
      }

      const rawRole =
        (decoded['role'] as string) ||
        (Array.isArray(decoded['roles']) ? (decoded['roles'][0] as string) : undefined) ||
        'SOLICITANTE';

      const role = this.normalizeRole(rawRole);
      const level = this.inferLevel(role, decoded['level'] as string | undefined);
      const maxApprovalLimit =
        typeof decoded['limiteAlcada'] === 'number'
          ? decoded['limiteAlcada']
          : typeof decoded['maxApprovalLimit'] === 'number'
            ? decoded['maxApprovalLimit']
            : undefined;

      return {
        userId,
        tenantId,
        email: decoded.email,
        fullName: (decoded['name'] as string) || (decoded['fullName'] as string),
        role,
        level,
        maxApprovalLimit,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Token de autenticação inválido ou assinatura não verificada.');
    }
  }

  private parseTokenDeTeste(
    token: string,
    headers: Record<string, string | string[] | undefined>,
  ): AuthenticatedUser {
    const [, tenantId, rawRole, userId = 'usr-aprov-01', rawLimit] = token.split(':');
    if (!tenantId || !rawRole) {
      throw new UnauthorizedException('Token de teste malformado.');
    }
    const role = this.normalizeRole(rawRole);
    const headerLimit = this.parseHeaderLimit(headers);
    const parsedLimit =
      rawLimit !== undefined && rawLimit !== '' ? Number(rawLimit) : headerLimit;

    return {
      userId,
      tenantId,
      role,
      level: this.inferLevel(role),
      maxApprovalLimit:
        parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    };
  }

  private parseFallbackNaoProducao(
    token: string,
    headers: Record<string, string | string[] | undefined>,
  ): AuthenticatedUser {
    const headerLimit = this.parseHeaderLimit(headers);

    // 1. Suporte a tokens JWT padrão (3 partes base64url) emitidos pelo Firebase Auth Emulator ou testes
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;

        if (typeof payload['exp'] === 'number' && payload['exp'] * 1000 < Date.now()) {
          throw new UnauthorizedException('Token JWT expirado.');
        }

        const tenantId =
          (payload['tenantId'] as string) ||
          (payload['tenant_id'] as string) ||
          this.getHeaderString(headers, 'x-tenant-id');

        const userId =
          (payload['user_id'] as string) ||
          (payload['sub'] as string) ||
          (payload['userId'] as string) ||
          (payload['uid'] as string);

        const rawRole =
          (payload['role'] as string) ||
          (Array.isArray(payload['roles']) ? (payload['roles'][0] as string) : undefined) ||
          this.getHeaderString(headers, 'x-user-role') ||
          'SOLICITANTE';

        if (!userId || !tenantId) {
          throw new UnauthorizedException(
            'Token JWT inválido: userId e tenantId são obrigatórios.',
          );
        }

        const role = this.normalizeRole(rawRole);
        const level = this.inferLevel(role, payload['level'] as string | undefined);
        const maxApprovalLimit =
          typeof payload['limiteAlcada'] === 'number'
            ? payload['limiteAlcada']
            : typeof payload['maxApprovalLimit'] === 'number'
              ? payload['maxApprovalLimit']
              : headerLimit;

        const costCenterId =
          (payload['costCenterId'] as string) ||
          (payload['centroCustoId'] as string) ||
          (payload['departmentCostCenter'] as string) ||
          (process.env['NODE_ENV'] !== 'production'
            ? this.getHeaderString(headers, 'x-cost-center-id')
            : undefined);

        const departmentId =
          (payload['departmentId'] as string) ||
          (payload['departamentoId'] as string) ||
          (process.env['NODE_ENV'] !== 'production'
            ? this.getHeaderString(headers, 'x-department-id')
            : undefined);

        return {
          userId,
          tenantId,
          email: payload['email'] as string | undefined,
          fullName: (payload['name'] as string) || (payload['fullName'] as string),
          role,
          level,
          maxApprovalLimit,
          costCenterId: costCenterId || null,
          departmentId: departmentId || null,
        };
      } catch (err) {
        if (err instanceof UnauthorizedException) {
          throw err;
        }
        throw new UnauthorizedException('Falha ao decodificar token JWT.');
      }
    }

    // 2. Formato estruturado para testes/emulador: "test:<tenantId>:<role>:<userId>:<limiteOpcional>"
    if (token.startsWith('test:')) {
      const [, tenantId, rawRole, userId = 'usr-aprov-01', rawLimit] = token.split(':');
      if (!tenantId || !rawRole) {
        throw new UnauthorizedException('Token de teste malformado.');
      }
      const role = this.normalizeRole(rawRole);
      const parsedLimit =
        rawLimit !== undefined && rawLimit !== '' ? Number(rawLimit) : headerLimit;

      const costCenterId = this.getHeaderString(headers, 'x-cost-center-id');
      const departmentId = this.getHeaderString(headers, 'x-department-id');

      return {
        userId,
        tenantId,
        role,
        level: this.inferLevel(role),
        maxApprovalLimit:
          parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        costCenterId: costCenterId || null,
        departmentId: departmentId || null,
      };
    }

    // 3. Suporte aos tokens de teste existentes na suíte E2E ("token-do-usuario-da-empresa-A")
    if (token.startsWith('token-do-usuario-da-empresa-')) {
      const suffix = token.replace('token-do-usuario-da-empresa-', '').trim();
      if (!suffix) {
        throw new UnauthorizedException('Token inválido.');
      }
      const roleHeader = this.getHeaderString(headers, 'x-user-role') || 'SOLICITANTE';
      const role = this.normalizeRole(roleHeader);
      return {
        userId: `usr-empresa-${suffix}`,
        tenantId: `empresa-${suffix}`,
        role,
        level: this.inferLevel(role),
        maxApprovalLimit: headerLimit,
      };
    }

    // 4. Suporte ao mock token do AuthService do frontend ("mock-jwt-token-alcadas-...")
    if (token.startsWith('mock-jwt-token-alcadas-')) {
      const tenantId = this.getHeaderString(headers, 'x-tenant-id') || 'startop';
      const roleHeader = this.getHeaderString(headers, 'x-user-role') || 'APROVADOR_N2';
      const role = this.normalizeRole(roleHeader);
      const costCenterId = this.getHeaderString(headers, 'x-cost-center-id');
      const departmentId = this.getHeaderString(headers, 'x-department-id');
      return {
        userId: this.getHeaderString(headers, 'x-user-id') || 'usr-aprov-01',
        tenantId,
        role,
        level: this.inferLevel(role),
        maxApprovalLimit: headerLimit,
        costCenterId: costCenterId || null,
        departmentId: departmentId || null,
      };
    }

    throw new UnauthorizedException('Token de autenticação inválido ou não reconhecido.');
  }

  private parseHeaderLimit(
    headers: Record<string, string | string[] | undefined>,
  ): number | undefined {
    const raw =
      this.getHeaderString(headers, 'x-approval-limit') ??
      this.getHeaderString(headers, 'x-limite-alcada');
    if (!raw) return undefined;
    const num = Number(raw);
    return Number.isFinite(num) ? num : undefined;
  }

  private getHeaderString(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ): string | undefined {
    const val = headers[key];
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  }

  private normalizeRole(rawRole: string): UserRole {
    const upper = rawRole.trim().toUpperCase();
    if (VALID_ROLES.has(upper)) {
      return upper as UserRole;
    }
    if (upper === 'ADMINISTRADOR') return 'ADMIN';
    if (upper === 'GERENTE' || upper === 'N2' || upper === 'APROVADOR_TITULAR') {
      return 'APROVADOR_N2';
    }
    if (upper === 'COORDENADOR' || upper === 'SUPERVISOR' || upper === 'N1') {
      return 'APROVADOR_N1';
    }
    if (upper === 'DIRETOR' || upper === 'CFO' || upper === 'N3') {
      return 'DIRETOR_CFO';
    }
    throw new UnauthorizedException(`Papel de usuário inválido: ${rawRole}`);
  }

  private inferLevel(role: UserRole, explicitLevel?: string): ApprovalLevel | undefined {
    if (explicitLevel === 'N1' || explicitLevel === 'N2' || explicitLevel === 'N3') {
      return explicitLevel;
    }
    if (role === 'APROVADOR_N1') return 'N1';
    if (role === 'APROVADOR_N2' || role === 'USER_NORMAL') return 'N2';
    if (role === 'DIRETOR_CFO' || role === 'SUPER_USER') return 'N3';
    return undefined;
  }
}
