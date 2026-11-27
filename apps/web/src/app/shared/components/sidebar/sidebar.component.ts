import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import {
  SettingsService,
  mapearRoleParaCargoPadrao,
} from '../../../features/settings/services/settings.service';
import { RequestsService } from '../../../features/requests/services/requests.service';
import { LimitsService } from '../../../features/limits/services/limits.service';
import { SidebarService } from '../../../core/services/sidebar.service';

export interface SubMenuItem {
  id: string;
  route: string;
  label: string;
  icon?: string;
  badge?: string | number | null;
  badgeColor?: string;
}

export interface MenuItem {
  id: string;
  featureKey?: string;
  route: string;
  label: string;
  icon: string;
  badge?: string | number | null;
  badgeColor?: string;
  hasSubmenu?: boolean;
  subItems?: SubMenuItem[];
}

export interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  color: string;
  isPinned: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  protected readonly authService = inject(AuthService);
  protected readonly settingsService = inject(SettingsService);
  protected readonly requestsService = inject(RequestsService);
  private readonly limitsService = inject(LimitsService);
  private readonly router = inject(Router);
  protected readonly sidebarService = inject(SidebarService);

  readonly isCollapsed = this.sidebarService.isCollapsed;
  readonly isTenantDropdownOpen = signal(false);
  private readonly pinnedIds = signal<Record<string, boolean>>({});

  // Sincroniza a aba ativa diretamente com a URL da rota
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly activeItem = computed(() => {
    const url = this.currentUrl();
    if (url.includes('/aprovacoes')) return 'aprovacoes';
    if (url.includes('/solicitacoes')) return 'solicitacoes';
    if (url.includes('/alcadas/regras')) return 'minhas-regras';
    if (url.includes('/alcadas')) return 'meus-fluxos';
    if (url.includes('/auditoria')) return 'auditoria';
    if (url.includes('/riscos')) return 'riscos';
    if (url.includes('/configuracoes')) return 'configuracoes';
    return 'dashboard';
  });

  readonly activeSubItem = computed(() => {
    return null;
  });

  readonly openSubmenus = signal<Record<string, boolean>>({});

  // Menu principal operacional (Organização, Delegações e Empresas ficam dentro de /configuracoes)
  private readonly allMenuItems: MenuItem[] = [
    {
      id: 'dashboard',
      featureKey: 'dashboard',
      route: '/dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      hasSubmenu: false,
    },
    {
      id: 'aprovacoes',
      featureKey: 'minhas_aprovacoes',
      route: '/aprovacoes',
      label: 'Minhas Aprovações',
      icon: 'check_circle',
      badge: null,
      badgeColor: '#644EF3',
      hasSubmenu: false,
    },
    {
      id: 'solicitacoes',
      featureKey: 'solicitacoes',
      route: '/solicitacoes',
      label: 'Minhas solicitações',
      icon: 'description',
      hasSubmenu: false,
    },
    {
      id: 'meus-fluxos',
      featureKey: 'meus_fluxos',
      route: '/alcadas/minhas-alcadas',
      label: 'Meus Fluxos',
      icon: 'account_tree',
      hasSubmenu: false,
    },
    {
      id: 'minhas-regras',
      featureKey: 'minhas_regras',
      route: '/alcadas/regras',
      label: 'Minhas Regras',
      icon: 'rule',
      hasSubmenu: false,
    },
  ];

  /**
   * Filtra os itens do menu lateral com base nas funcionalidades liberadas para a profissão
   * do colaborador na tela de Delegações (/configuracoes/delegacoes) da empresa dele.
   */
  readonly mainMenuItems = computed<MenuItem[]>(() => {
    const permitidas = this.settingsService.currentUserAllowedFeatures();
    const pendentes = this.requestsService.stats().pendentes;
    return this.allMenuItems
      .filter((item) => !item.featureKey || permitidas.includes(item.featureKey))
      .map((item) =>
        item.id === 'aprovacoes'
          ? { ...item, badge: pendentes > 0 ? pendentes : null }
          : item,
      );
  });

  readonly departments = computed<DepartmentItem[]>(() => {
    const pinned = this.pinnedIds();
    return this.settingsService.organization().departments.map((d, idx) => ({
      id: d.id,
      code: d.code.slice(0, 2).toUpperCase(),
      name: d.name,
      color: d.color || '#644EF3',
      isPinned: pinned[d.id] ?? idx < 3,
    }));
  });

  readonly isDev = computed(() => {
    const email = (
      this.authService.currentUser()?.email || this.settingsService.activeUserEmail()
    ).toLowerCase();
    const id = this.authService.currentUser()?.id;
    return email === 'dev@alcadas.com' || id === 'dev-master';
  });

  readonly canManageDepartments = computed(() => {
    return this.settingsService.currentUserAllowedFeatures().includes('organizacao');
  });

  readonly userRoleDisplay = computed(() => {
    if (this.isDev()) {
      return 'Desenvolvedor (Super Admin)';
    }
    const user = this.authService.currentUser();
    if (user?.profissaoNome) {
      return user.profissaoNome;
    }
    const profileJobTitle = this.settingsService.userProfile().jobTitle;
    if (profileJobTitle && profileJobTitle !== 'Desenvolvedor (Super Admin)') {
      return profileJobTitle;
    }
    const role = user?.role || this.settingsService.activeUserRole();
    return mapearRoleParaCargoPadrao(role);
  });

  constructor() {
    effect(() => {
      const url = this.currentUrl();
      if (url.includes('/alcadas/editor') || url.includes('/alcadas/novo')) {
        this.sidebarService.collapse();
      }
    });
  }

  toggleCollapse(): void {
    this.sidebarService.toggle();
    if (this.isCollapsed()) {
      this.isTenantDropdownOpen.set(false);
    }
  }

  toggleTenantDropdown(event: Event): void {
    event.stopPropagation();
    if (this.isCollapsed()) {
      this.sidebarService.expand();
      return;
    }
    if (!this.isDev()) {
      return;
    }
    this.isTenantDropdownOpen.update((v) => !v);
  }

  selectTenant(tenantId: string, event: Event): void {
    event.stopPropagation();
    this.settingsService.activeTenantId.set(tenantId);
    this.isTenantDropdownOpen.set(false);
    this.requestsService.ensureLoaded();
    this.limitsService.loadFromBackend();
  }

  isSubmenuOpen(itemId: string): boolean {
    return !!this.openSubmenus()[itemId];
  }

  toggleSubmenu(itemId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.openSubmenus.update((state) => ({
      ...state,
      [itemId]: !state[itemId],
    }));
  }

  selectItem(item: MenuItem): void {
    if (!item) return;
    if (item.hasSubmenu && item.subItems && item.subItems.length > 0) {
      if (this.isCollapsed()) {
        this.sidebarService.expand();
      }
      this.openSubmenus.update((state) => ({
        ...state,
        [item.id]: true,
      }));
      if (!this.currentUrl().includes('/alcadas')) {
        void this.router.navigate([item.route]);
      }
    } else {
      void this.router.navigate([item.route]);
    }
  }

  selectSubItem(subItem: SubMenuItem, event: Event): void {
    event.stopPropagation();
    void this.router.navigate([subItem.route]);
  }

  togglePin(id: string, event: Event): void {
    event.stopPropagation();
    const current = this.departments().find((d) => d.id === id)?.isPinned ?? false;
    this.pinnedIds.update((prev) => ({
      ...prev,
      [id]: !current,
    }));
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
