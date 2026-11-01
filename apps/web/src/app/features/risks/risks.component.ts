import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-risks',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <app-page-header
      breadcrumbRoot="Governança"
      breadcrumbCurrent="Motor de Riscos"
      searchPlaceholder="Buscar regras de risco ou alertas..."
      contextIcon="security"
      contextTitle="Motor de Riscos & Anti-Fraude"
      contextSubtitle="Detecção de fracionamento de despesas (30 dias) e duplicidade de lançamentos (7 dias)"
    >
      <div header-actions class="header-actions-group">
        <span class="status-pill status-success">
          <span class="status-dot"></span>
          <span>0 Alertas Críticos</span>
        </span>
      </div>
    </app-page-header>
    <div class="page-content">
      <div class="empty-state-card">
        <span class="material-symbols-rounded empty-icon">security</span>
        <h3>Monitoramento Ativo de Conformidade</h3>
        <p>Varredura matemática em janelas móveis para prevenção de irregularidades e burla de alçadas.</p>
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
    .empty-icon { font-size: 48px; color: #F59E0B; margin-bottom: 1rem; }
    h3 { margin: 0 0 0.5rem; color: #0f172a; font-size: 1.15rem; font-weight: 700; }
    p { margin: 0; color: #64748b; font-size: 0.85rem; }
  `]
})
export class RisksComponent {}
