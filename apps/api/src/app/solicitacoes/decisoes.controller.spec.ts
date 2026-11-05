import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser, UserRole } from '@alcadas-core/models';
import { ROLES_KEY } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import { DecisoesController, PAPEIS_APROVADORES } from './decisoes.controller';

type Handler = keyof DecisoesController;

function contextoPara(handler: Handler, role: UserRole): ExecutionContext {
  const user: AuthenticatedUser = { userId: 'u1', tenantId: 'startop', role };
  return {
    getHandler: () => DecisoesController.prototype[handler],
    getClass: () => DecisoesController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('DecisoesController — RBAC (ADR-007)', () => {
  const guard = new RolesGuard(new Reflector());

  it.each<Handler>(['aprovar', 'rejeitar', 'solicitarAjuste', 'obterTrilha', 'verificarTrilha'])(
    'a rota %s declara @Roles',
    (handler) => {
      const roles = Reflect.getMetadata(ROLES_KEY, DecisoesController.prototype[handler]);
      expect(Array.isArray(roles) && roles.length > 0).toBe(true);
    },
  );

  it.each<Handler>(['aprovar', 'rejeitar', 'solicitarAjuste'])(
    'US-09: SOLICITANTE, AUDITOR e ADMIN recebem 403 em %s',
    (handler) => {
      for (const role of ['SOLICITANTE', 'AUDITOR', 'ADMIN'] as UserRole[]) {
        expect(() => guard.canActivate(contextoPara(handler, role))).toThrow(ForbiddenException);
      }
    },
  );

  it.each(PAPEIS_APROVADORES)('aprovador %s passa pelo guard de papel em aprovar', (role) => {
    expect(guard.canActivate(contextoPara('aprovar', role))).toBe(true);
  });

  it.each<UserRole>(['AUDITOR', 'ADMIN', 'SOLICITANTE'])('%s pode consultar a trilha', (role) => {
    expect(guard.canActivate(contextoPara('obterTrilha', role))).toBe(true);
  });
});
