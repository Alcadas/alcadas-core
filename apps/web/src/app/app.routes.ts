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
