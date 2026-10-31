import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
  path: 'register',
  loadComponent: () =>
    import('./features/register/register.component').then(
      (m) => m.RegisterComponent
    ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Perfil | Alçadas',
    // canActivate: [authGuard], // descomente quando o guard do Firebase Auth existir
  },
  {
  path: 'verificarCodigo',
  loadComponent: () =>
    import('./features/auth/pages/verificar-codigo/verificar-codigo').then(
      (m) => m.VerificarCodigo
    ),
  },
  {
  path: 'novaSenha',
  loadComponent: () =>
    import('./features/auth/pages/nova-senha/nova-senha').then(
      (m) => m.NovaSenha
    ),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: 'aprovacoes',
    loadComponent: () =>
      import('./features/approvals/approvals.component').then(
        (m) => m.ApprovalsComponent
      ),
  },
  {
    path: 'solicitacoes',
    loadComponent: () =>
      import('./features/requests/requests.component').then(
        (m) => m.RequestsComponent
      ),
  },
  {
    path: 'alcadas',
    loadComponent: () =>
      import('./features/limits/limits.component').then(
        (m) => m.LimitsComponent
      ),
  },
  {
    path: 'auditoria',
    loadComponent: () =>
      import('./features/audit/audit.component').then(
        (m) => m.AuditComponent
      ),
  },
  {
    path: 'riscos',
    loadComponent: () =>
      import('./features/risks/risks.component').then(
        (m) => m.RisksComponent
      ),
  },
  {
    path: 'delegacoes',
    loadComponent: () =>
      import('./features/delegations/delegations.component').then(
        (m) => m.DelegationsComponent
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
