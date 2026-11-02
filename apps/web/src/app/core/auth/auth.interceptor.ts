import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { AuthService } from './auth.service';

/**
 * Envia o ID token do Firebase Auth em toda chamada à API (e só à API — nunca ao Firebase).
 * Se a API responder 401, a sessão é encerrada e o usuário volta para o login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const { apiBaseUrl } = inject(APP_CONFIG);
  if (!ehChamadaDaApi(req.url, apiBaseUrl)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.obterTokenValido().pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && erro.status === 401) {
        authService.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => erro);
    }),
  );
};

function ehChamadaDaApi(url: string, apiBaseUrl: string): boolean {
  const base = apiBaseUrl.replace(/\/+$/, '');
  return url === base || url.startsWith(`${base}/`);
}
