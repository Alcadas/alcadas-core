import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { SettingsService } from '../../features/settings/services/settings.service';
import { AuthService } from './auth.service';

/**
 * Libera as rotas internas só para quem está logado e possui permissão na matriz
 * de Delegações (/delegacoes) da empresa ativa; caso contrário redireciona.
 */
export const authGuard: CanActivateFn & CanActivateChildFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  const url = state?.url;
  if (url) {
    const settingsService = inject(SettingsService);
    if (!settingsService.canCurrentUserAccessUrl(url)) {
      return router.createUrlTree([settingsService.getFirstAllowedRouteForCurrentUser()]);
    }
  }
  return true;
};
