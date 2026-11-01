import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <app-page-header
      breadcrumbRoot="Governança"
      breadcrumbCurrent="Trilha de Auditoria"
      searchPlaceholder="Buscar registros de hash..."
      contextIcon="link"
      contextTitle="Trilha Criptográfica de Auditoria"
      contextSubtitle="Cadeia imutável de elos encadeados por hashes SHA-256 à prova de adulteração"
    >
      <div header-actions class="header-actions-group">
        <span class="status-pill status-success">
          <span class="status-dot"></span>
          <span>1.428 Elos Íntegros</span>
        </span>
      </div>
    </app-page-header>
    <div class="page-content">
      <div class="empty-state-card">
        <span class="material-symbols-rounded empty-icon">link</span>
        <h3>Rastreabilidade e Cadeia de Hashes</h3>
        <p>Validação determinística contínua em tempo real com recálculo em menos de 1 segundo.</p>
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
    .empty-icon { font-size: 48px; color: #10B981; margin-bottom: 1rem; }
    h3 { margin: 0 0 0.5rem; color: #0f172a; font-size: 1.15rem; font-weight: 700; }
    p { margin: 0; color: #64748b; font-size: 0.85rem; }
  `]
})
export class AuditComponent {}
