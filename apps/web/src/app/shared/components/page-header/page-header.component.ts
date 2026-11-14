import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

export interface PageHeaderTab {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'adjust' | 'neutral';
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  private readonly router = inject(Router);

  // Tier 1: Breadcrumb & Busca
  readonly breadcrumbRoot = input<string>('Alçadas');
  readonly breadcrumbCurrent = input.required<string>();
  readonly searchPlaceholder = input<string>('Search...');
  readonly showSearch = input<boolean>(true);
  readonly searchQuery = input<string>('');
  readonly showQuickIcons = input<boolean>(true);
  readonly hasUnreadAlerts = input<boolean>(false);

  // Tier 2: Sub-header de Contexto & Abas
  readonly showTier2 = input<boolean>(true);
  readonly contextIcon = input<string | null>(null);
  readonly contextTitle = input<string | null>(null);
  readonly contextSubtitle = input<string | null>(null);
  readonly tabs = input<PageHeaderTab[]>([]);
  readonly activeTab = input<string>('');

  // Eventos de saída
  readonly searchQueryChange = output<string>();
  readonly tabChange = output<string>();
  readonly quickAction = output<string>();

  onSearchInput(value: string): void {
    this.searchQueryChange.emit(value);
  }

  clearSearch(): void {
    this.searchQueryChange.emit('');
  }

  selectTab(tabId: string): void {
    this.tabChange.emit(tabId);
  }

  onQuickActionClick(action: string): void {
    if (action === 'tutorials') {
      void this.router.navigate(['/tutoriais']);
    }
    this.quickAction.emit(action);
  }
}
