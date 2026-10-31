import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | number | null;
  badgeColor?: string;
  hasSubmenu?: boolean;
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
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isCollapsed = signal(false);
  readonly activeItem = signal('dashboard');
  readonly searchQuery = signal('');

  readonly mainMenuItems = signal<MenuItem[]>([
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', hasSubmenu: false },
    { id: 'aprovacoes', label: 'Minhas Aprovações', icon: 'check_circle', badge: 3, badgeColor: '#644EF3', hasSubmenu: true },
    { id: 'solicitacoes', label: 'Solicitações', icon: 'description', hasSubmenu: true },
    { id: 'alcadas', label: 'Alçadas & Tetos', icon: 'shield', hasSubmenu: true },
    { id: 'auditoria', label: 'Trilha Criptográfica', icon: 'link', badge: 'SHA', badgeColor: '#10B981', hasSubmenu: false },
    { id: 'riscos', label: 'Motor de Riscos', icon: 'security', badge: 'Anti-Fraude', badgeColor: '#F59E0B', hasSubmenu: false },
    { id: 'delegacoes', label: 'Delegações & SoD', icon: 'group', hasSubmenu: true },
  ]);

  readonly departments = signal<DepartmentItem[]>([
    { id: 'eng', code: 'E', name: 'Engenharia', color: '#10B981', isPinned: true },
    { id: 'arq', code: 'A', name: 'Arquitetura', color: '#8B5CF6', isPinned: true },
    { id: 'ti', code: 'TI', name: 'Tecnologia & Infra', color: '#644EF3', isPinned: true },
    { id: 'fin', code: 'F', name: 'Controladoria & Finanças', color: '#F59E0B', isPinned: false },
    { id: 'op', code: 'O', name: 'Operações & Logística', color: '#EC4899', isPinned: false },
  ]);

  toggleCollapse(): void {
    this.isCollapsed.update((v) => !v);
  }

  selectItem(id: string): void {
    this.activeItem.set(id);
    if (id === 'dashboard') {
      this.router.navigate(['/dashboard']);
    }
  }

  togglePin(id: string, event: Event): void {
    event.stopPropagation();
    this.departments.update((items) =>
      items.map((item) => (item.id === id ? { ...item, isPinned: !item.isPinned } : item))
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
