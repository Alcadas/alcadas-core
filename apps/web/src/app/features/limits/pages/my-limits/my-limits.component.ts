import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LimitsService } from '../../services/limits.service';

@Component({
  selector: 'app-my-limits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-limits.component.html',
  styleUrl: './my-limits.component.scss',
})
export class MyLimitsComponent {
  private readonly router = inject(Router);
  protected readonly limitsService = inject(LimitsService);

  // Estado de Carregamento da Lista
  readonly isLoading = signal(true);

  // Controle de menu contextual de ações
  readonly openMenuId = signal<string | null>(null);

  // Controle do modal de criação
  readonly isCreateModalOpen = signal(false);
  readonly newRuleTitle = signal('');
  readonly newRuleDept = signal('Tecnologia & Infra');
  readonly newRuleAmount = signal(25000);
  readonly newRuleQuorum = signal('2 Aprovadores (Quórum Duplo)');

  // Tabs do topo
  readonly tabs = [
    { id: 'all', label: 'Todas as Alçadas', icon: 'shield' },
    { id: 'active', label: 'Ativas', icon: 'check_circle' },
    { id: 'draft', label: 'Rascunhos', icon: 'edit_note' },
    { id: 'completed', label: 'Homologadas', icon: 'task_alt' },
    { id: 'ti', label: 'Tecnologia & Infra', icon: 'devices' },
  ];

  selectTab(tabId: string): void {
    this.limitsService.activeTab.set(tabId);
  }

  onSearchChange(val: string): void {
    this.limitsService.searchQuery.set(val);
  }

  toggleActionsMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  closeActionsMenu(): void {
    this.openMenuId.set(null);
  }

  navigateToEditor(ruleId: string): void {
    this.router.navigate(['/alcadas/editor', ruleId]);
  }

  goToRulesCatalog(): void {
    this.router.navigate(['/alcadas/regras']);
  }

  openCreateModal(): void {
    this.newRuleTitle.set('');
    this.newRuleAmount.set(25000);
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  confirmCreate(): void {
    const title = this.newRuleTitle().trim() || 'Nova Regra de Alçada';
    const newRule = this.limitsService.createRule({
      title,
      department: this.newRuleDept(),
      ceilingAmount: this.newRuleAmount(),
      quorumLabel: this.newRuleQuorum(),
      assignedTo: `Atribuído a ${this.newRuleDept()}`,
    });

    this.closeCreateModal();
    this.router.navigate(['/alcadas/editor', newRule.id]);
  }

  duplicateRule(id: string, event: Event): void {
    event.stopPropagation();
    this.closeActionsMenu();
    this.limitsService.duplicateRule(id);
  }

  deleteRule(id: string, event: Event): void {
    event.stopPropagation();
    this.closeActionsMenu();
    this.limitsService.deleteRule(id);
  }

  constructor() {
    // Simula carregamento de regras e políticas da API
    setTimeout(() => {
      this.isLoading.set(false);
    }, 500);
  }
}
