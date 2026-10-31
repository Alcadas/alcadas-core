import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-delegations',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <app-page-header
      breadcrumbRoot="Governança"
      breadcrumbCurrent="Delegações"
      searchPlaceholder="Buscar substitutos ou cargos..."
      contextIcon="group"
      contextTitle="Delegações & Segregação de Funções (SoD)"
      contextSubtitle="Gestão de substitutos temporários com controle de conflito de papéis"
    >
      <div header-actions class="header-actions-group">
        <button type="button" class="btn-header-primary">
          <span class="material-symbols-rounded">add</span>
          <span>Nova Delegação</span>
        </button>
      </div>
    </app-page-header>
    <div class="page-content">
      <div class="empty-state-card">
        <span class="material-symbols-rounded empty-icon">group</span>
        <h3>Controle de Conflitos e Delegações</h3>
        <p>Atribuição temporária de competências com bloqueio estrito de autoaprovação.</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; width: 100%; min-width: 0; overflow: hidden; }
    .header-actions-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .page-content { flex: 1; padding: 2rem; overflow-y: auto; }
    .empty-state-card {
      background: #ffffff; border: 1px solid #eef2f6; border-radius: 16px; padding: 3rem 2rem; text-align: center;
      max-width: 600px; margin: 2rem auto; box-shadow: 0 4px 16px rgba(0,0,0,0.02);
    }
    .empty-icon { font-size: 48px; color: #644EF3; margin-bottom: 1rem; }
    h3 { margin: 0 0 0.5rem; color: #0f172a; font-size: 1.15rem; font-weight: 700; }
    p { margin: 0; color: #64748b; font-size: 0.85rem; }
  `]
})
export class DelegationsComponent {}
