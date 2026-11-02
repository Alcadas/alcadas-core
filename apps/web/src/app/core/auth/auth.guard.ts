import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Libera as rotas internas só para quem está logado; os demais vão para /login. */
export const authGuard: CanActivateFn & CanActivateChildFn = () => {
  const authService = inject(AuthService);
  return authService.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};
