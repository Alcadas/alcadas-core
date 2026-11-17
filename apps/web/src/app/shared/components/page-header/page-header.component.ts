import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TourService } from '../../../core/services/tour.service';

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
  private readonly elementRef = inject(ElementRef);
  protected readonly tourService = inject(TourService);

  // Estado do Dropdown de Ajuda & Tutoriais
  readonly isTutorialDropdownOpen = signal<boolean>(false);

  // Tier 1: Breadcrumb & Busca
  readonly breadcrumbRoot = input<string>('Alçadas');
  readonly breadcrumbCurrent = input.required<string>();
  readonly searchPlaceholder = input<string>('Search...');
  readonly showSearch = input<boolean>(true);
  readonly searchQuery = input<string>('');
  readonly showQuickIcons = input<boolean>(true);
  readonly hasUnreadAlerts = input<boolean>(false);

  // Nome legível da tela atual para o rótulo do dropdown
  readonly currentScreenName = computed(() => this.breadcrumbCurrent() || 'esta tela');

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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isTutorialDropdownOpen()) return;
    const target = event.target as HTMLElement | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.closeTutorialDropdown();
    }
  }

  toggleTutorialDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isTutorialDropdownOpen.update((open) => !open);
  }

  closeTutorialDropdown(): void {
    this.isTutorialDropdownOpen.set(false);
  }

  startTourForCurrentScreen(): void {
    this.closeTutorialDropdown();
    this.tourService.startTourForCurrentRoute();
    this.quickAction.emit('tour');
  }

  startCreateRequestTour(): void {
    this.closeTutorialDropdown();
    this.tourService.startTour('criar-solicitacao');
    this.quickAction.emit('tour-create-request');
  }

  startGeneralTour(): void {
    this.closeTutorialDropdown();
    this.tourService.startTour('onboarding');
    this.quickAction.emit('tour-general');
  }

  goToTutorialsGuide(): void {
    this.closeTutorialDropdown();
    void this.router.navigate(['/tutoriais']);
    this.quickAction.emit('tutorials');
  }

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
      this.goToTutorialsGuide();
    } else if (action === 'tour') {
      this.startTourForCurrentScreen();
    }
    this.quickAction.emit(action);
  }
}
