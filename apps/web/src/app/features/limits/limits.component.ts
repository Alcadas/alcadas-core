import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-limits',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="ops-header">
      <div class="header-titles">
        <h1 class="header-main-title">Alçadas & Tetos Orçamentários</h1>
        <p class="header-sub-title">Matriz de limites de aprovação por cargo, nível hierárquico e centro de custo.</p>
      </div>
    </header>
    <div class="page-content">
      <div class="empty-state-card">
        <span class="material-symbols-rounded empty-icon">shield</span>
        <h3>Matriz de Alçadas Operacionais</h3>
        <p>Configuração e parametrização de faixas de valor e instâncias decisórias.</p>
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
export class LimitsComponent {}
