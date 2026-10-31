import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser, UserRole } from '@alcadas-core/models';

export const ROLES_KEY = 'alcadas_roles';

/**
 * Decorator para restringir rotas a papéis específicos (RBAC - ADR-007 / RNF03).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator para extrair o usuário autenticado (com tenantId, userId, role e alçada) da requisição.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
