import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <app-page-header
      breadcrumbRoot="Aprovações"
      breadcrumbCurrent="Minhas Aprovações"
      searchPlaceholder="Buscar na fila de aprovação..."
      contextIcon="check_circle"
      contextTitle="Fila de Análise e Deliberação"
      contextSubtitle="Solicitações aguardando sua assinatura de governança dentro da alçada"
      [showTier2]="true"
    >
      <div header-actions class="header-actions-group">
        <button type="button" class="btn-header-outline">
          <span class="material-symbols-rounded">filter_list</span>
          <span>Filtros</span>
        </button>
        <button type="button" class="btn-header-primary">
          <span class="material-symbols-rounded">done_all</span>
          <span>Aprovar em Lote</span>
        </button>
      </div>
    </app-page-header>

    <div class="page-content">
      <div class="empty-state-card">
        <span class="material-symbols-rounded empty-icon">check_circle</span>
        <h3>Fila de Análise e Deliberação</h3>
        <p>Você possui 3 solicitações dentro da sua alçada de aprovação (até R$ 50.000).</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; width: 100%; min-width: 0; overflow: hidden; background: #f8fafc; }
    .header-actions-group { display: flex; align-items: center; gap: 0.65rem; }
    .page-content { flex: 1; padding: 2rem; overflow-y: auto; }
    .empty-state-card {
      background: #ffffff; border: 1px solid #eef2f6; border-radius: 12px; padding: 3rem 2rem; text-align: center;
      max-width: 600px; margin: 2rem auto; box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .empty-icon { font-size: 48px; color: #644EF3; margin-bottom: 1rem; }
    h3 { margin: 0 0 0.5rem; color: #0f172a; font-size: 1.15rem; font-weight: 700; }
    p { margin: 0; color: #64748b; font-size: 0.825rem; }
  `]
})
export class ApprovalsComponent {}
