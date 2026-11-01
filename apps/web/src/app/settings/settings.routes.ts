import { Routes } from '@angular/router';
import { SettingsShellComponent } from './settings-shell/settings-shell.component';

// No app.routes.ts:
// { path: 'configuracoes', loadChildren: () => import('./settings/settings.routes').then(m => m.SETTINGS_ROUTES) }
export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'perfil' },
      {
        path: 'perfil',
        title: 'Perfil · Alçadas',
        loadComponent: () => import('./profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'empresa',
        title: 'Empresa · Alçadas',
        // TODO: proteger com guard de papel (somente Administrador edita a empresa)
        loadComponent: () => import('./company/company.component').then((m) => m.CompanyComponent),
      },
      {
        path: 'seguranca',
        title: 'Segurança · Alçadas',
        loadComponent: () => import('./security/security.component').then((m) => m.SecurityComponent),
      },
    ],
  },
];
