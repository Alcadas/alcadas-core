import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SettingsService } from '../../services/settings.service';

export interface SettingsNavItem {
  path: string;
  label: string;
  icon: string;
  badge?: string;
  externalHint?: boolean;
}

@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.scss',
})
export class SettingsShellComponent {
  readonly settingsService = inject(SettingsService);
  readonly isNavCollapsed = signal(false);

  readonly personalItems: SettingsNavItem[] = [
    { path: 'perfil', label: 'Perfil', icon: 'account_circle' },
    { path: 'seguranca', label: 'Segurança', icon: 'lock' },
    { path: 'notificacoes', label: 'Notificações & Alertas', icon: 'notifications' },
  ];

  readonly workspaceItems = computed<SettingsNavItem[]>(() => {
    const allowed = this.settingsService.currentUserAllowedFeatures();
    const isSuper = this.settingsService.isPlatformSuperAdmin();
    const items: SettingsNavItem[] = [];

    if (isSuper || allowed.includes('organizacao') || allowed.includes('delegacoes')) {
      items.push({
        path: 'organizacao',
        label: 'Organização & Empresa',
        icon: 'domain',
        badge: this.settingsService.activeTenant().organization.tradeName.split(' ')[0],
      });
    }

    if (isSuper || allowed.includes('delegacoes') || allowed.includes('organizacao')) {
      items.push({
        path: 'delegacoes',
        label: 'Delegações & Acessos',
        icon: 'admin_panel_settings',
        badge: 'RBAC',
      });
    }

    return items;
  });

  readonly platformSaasItems = computed<SettingsNavItem[]>(() => {
    if (!this.settingsService.isPlatformSuperAdmin()) {
      return [];
    }
    return [
      {
        path: 'clientes',
        label: 'Empresas & Clientes',
        icon: 'apartment',
        badge: 'SaaS',
      },
    ];
  });

  toggleSubnav(): void {
    this.isNavCollapsed.update((v) => !v);
  }

  constructor() {
    this.settingsService.carregarOuSincronizarTenantsComBackend();
  }
}
