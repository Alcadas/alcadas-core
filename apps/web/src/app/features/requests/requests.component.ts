import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="ops-header">
      <div class="header-titles">
        <h1 class="header-main-title">Minhas Solicitações</h1>
        <p class="header-sub-title">Acompanhe seus pedidos de compra, reembolso e contratação de serviços.</p>
      </div>
      <div class="header-actions">
        <button type="button" class="btn-primary">
          <span class="material-symbols-rounded btn-icon">add</span>
          <span>Nova Solicitação</span>
        </button>
      </div>
    </header>

    <div class="page-content">
      <div class="empty-state-card">
        <span class="material-symbols-rounded empty-icon">description</span>
        <h3>Central de Pedidos e Aquisições</h3>
        <p>Inicie uma nova solicitação com anexos e cálculo automático de alçada.</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; width: 100%; min-width: 0; overflow: hidden; }
    .ops-header {
      height: 68px; max-height: 68px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between;
      padding: 0 2rem; background: #ffffff; border-bottom: 1px solid #eef2f6; flex-shrink: 0;
    }
    .header-main-title { margin: 0; font-size: 1.25rem; font-weight: 700; color: #0f172a; }
    .header-sub-title { margin: 0.15rem 0 0; font-size: 0.775rem; color: #64748b; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.95rem; border-radius: 8px;
      font-size: 0.825rem; font-weight: 600; cursor: pointer; background: #644EF3; border: none; color: #ffffff;
      box-shadow: 0 4px 12px rgba(100, 78, 243, 0.25);
    }
    .btn-icon { font-size: 18px; }
    .page-content { flex: 1; padding: 2rem; overflow-y: auto; }
    .empty-state-card {
      background: #ffffff; border: 1px solid #eef2f6; border-radius: 16px; padding: 3rem 2rem; text-align: center;
      max-width: 600px; margin: 2rem auto; box-shadow: 0 4px 16px rgba(0,0,0,0.02);
    }
    .empty-icon { font-size: 48px; color: #644EF3; margin-bottom: 1rem; }
    h3 { margin: 0 0 0.5rem; color: #0f172a; font-size: 1.2rem; }
    p { margin: 0; color: #64748b; font-size: 0.9rem; }
  `]
})
export class RequestsComponent {}
