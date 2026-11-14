import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourService } from '../../../core/services/tour.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SettingsService } from '../../../features/settings/services/settings.service';

@Component({
  selector: 'app-welcome-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (tourService.showWelcomeModal()) {
      <div
        class="welcome-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        tabindex="0"
        (click)="onOverlayClick($event)"
        (keydown)="onKeyDown($event)"
      >
        <div class="welcome-modal-container">
          <!-- Topo com Ilustração e Gradiente -->
          <div class="welcome-modal-hero">
            <div class="hero-brand-badge">
              <span class="material-symbols-rounded">verified_user</span>
              <span>Alçadas & Governança Corporativa</span>
            </div>
            <h2 id="welcome-modal-title" class="hero-title">
              Bem-vindo ao Alçadas, {{ primeiroNome() }}!
            </h2>
            <p class="hero-subtitle">
              Sua empresa <strong>{{ nomeEmpresa() }}</strong> está pronta para operar com esteiras automatizadas, limites de aprovação e integridade criptográfica.
            </p>
          </div>

          <!-- Pilares do Sistema -->
          <div class="welcome-modal-body">
            <div class="pillars-grid">
              <div class="pillar-card">
                <div class="pillar-icon-box purple">
                  <span class="material-symbols-rounded">receipt_long</span>
                </div>
                <div class="pillar-info">
                  <strong>1. Solicitações Ágeis</strong>
                  <p>Abra pedidos de compras e despesas anexando cotações e centro de custo em poucos cliques.</p>
                </div>
              </div>

              <div class="pillar-card">
                <div class="pillar-icon-box blue">
                  <span class="material-symbols-rounded">rule</span>
                </div>
                <div class="pillar-info">
                  <strong>2. Limites Automáticos</strong>
                  <p>O motor avalia o teto do seu cargo e departamento, direcionando para a esteira certa sem burocracia.</p>
                </div>
              </div>

              <div class="pillar-card">
                <div class="pillar-icon-box green">
                  <span class="material-symbols-rounded">security</span>
                </div>
                <div class="pillar-info">
                  <strong>3. Assinatura SHA-256 & SoD</strong>
                  <p>Aprovações com assinatura digital auditável e proteção estrita contra conflitos de interesse.</p>
                </div>
              </div>
            </div>

            <!-- Dica de Central de Tutoriais -->
            <div class="tutorial-tip-box">
              <span class="material-symbols-rounded tip-icon">school</span>
              <div class="tip-content">
                <span>Criamos a <strong>Central de Tutoriais</strong> completa para guiar você passo a passo pelos processos da empresa.</span>
              </div>
            </div>
          </div>

          <!-- Rodapé com Ações -->
          <div class="welcome-modal-footer">
            <button
              type="button"
              class="btn-footer-link"
              (click)="fecharModal()"
              title="Explorar o sistema por conta própria"
            >
              Explorar sozinho
            </button>

            <div class="primary-actions-group">
              <button
                type="button"
                class="btn-footer-secondary"
                (click)="irParaTutoriais()"
                title="Acessar Central de Tutoriais e Manuais"
              >
                <span class="material-symbols-rounded">menu_book</span>
                <span>Ver Tutoriais</span>
              </button>

              <button
                type="button"
                class="btn-footer-primary"
                (click)="iniciarTour()"
                title="Iniciar um tour guiado interativo pelas telas"
              >
                <span class="material-symbols-rounded">play_arrow</span>
                <span>Fazer Tour pelo App</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .welcome-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(6px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .welcome-modal-container {
      width: 100%;
      max-width: 640px;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: scaleUp 0.24s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .welcome-modal-hero {
      background: linear-gradient(135deg, #644ef3 0%, #4338ca 100%);
      padding: 2.25rem 2rem 2rem;
      color: #ffffff;
      position: relative;

      .hero-brand-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(4px);
        font-size: 0.75rem;
        font-weight: 600;
        margin-bottom: 0.85rem;

        .material-symbols-rounded {
          font-size: 16px;
        }
      }

      .hero-title {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        line-height: 1.25;
        letter-spacing: -0.02em;
      }

      .hero-subtitle {
        margin: 0.5rem 0 0;
        font-size: 0.875rem;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.9);
      }
    }

    .welcome-modal-body {
      padding: 1.75rem 2rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .pillars-grid {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .pillar-card {
      display: flex;
      align-items: flex-start;
      gap: 0.9rem;
      padding: 0.75rem 0.9rem;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;

      .pillar-icon-box {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        .material-symbols-rounded {
          font-size: 20px;
        }

        &.purple {
          background: #f1eeff;
          color: #644ef3;
        }
        &.blue {
          background: #e0f2fe;
          color: #0284c7;
        }
        &.green {
          background: #dcfce7;
          color: #16a34a;
        }
      }

      .pillar-info {
        strong {
          display: block;
          font-size: 0.875rem;
          color: #0f172a;
          margin-bottom: 0.15rem;
        }

        p {
          margin: 0;
          font-size: 0.8125rem;
          color: #64748b;
          line-height: 1.4;
        }
      }
    }

    .tutorial-tip-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      background: #fdf8f6;
      border: 1px solid #fed7aa;
      color: #9a3412;
      font-size: 0.8125rem;

      .tip-icon {
        font-size: 20px;
        color: #ea580c;
        flex-shrink: 0;
      }
    }

    .welcome-modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.25rem 2rem 1.75rem;
      border-top: 1px solid #f1f5f9;
      flex-wrap: wrap;

      .btn-footer-link {
        background: transparent;
        border: none;
        color: #64748b;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        padding: 0.5rem 0.25rem;

        &:hover {
          color: #0f172a;
          text-decoration: underline;
        }
      }

      .primary-actions-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .btn-footer-secondary {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.6rem 1rem;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #334155;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .material-symbols-rounded {
          font-size: 18px;
        }
      }

      .btn-footer-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.6rem 1.25rem;
        border-radius: 10px;
        border: none;
        background: #644ef3;
        color: #ffffff;
        font-size: 0.84rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(100, 78, 243, 0.35);
        transition: all 0.15s ease;

        &:hover {
          background: #503cd1;
          box-shadow: 0 6px 16px rgba(100, 78, 243, 0.45);
        }

        .material-symbols-rounded {
          font-size: 18px;
        }
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleUp {
      from { transform: scale(0.96); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `],
})
export class WelcomeModalComponent {
  readonly tourService = inject(TourService);
  private readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);

  primeiroNome(): string {
    const nomeCompleto =
      this.authService.currentUser()?.name ||
      this.settingsService.userProfile().displayName ||
      'Colaborador';
    return nomeCompleto.split(' ')[0] || nomeCompleto;
  }

  nomeEmpresa(): string {
    return this.settingsService.organization().tradeName || 'Startop Alçadas';
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.fecharModal();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.fecharModal();
    }
  }

  fecharModal(): void {
    this.tourService.dismissWelcomeModal(true);
  }

  iniciarTour(): void {
    this.tourService.startTourFromWelcome();
  }

  irParaTutoriais(): void {
    this.tourService.navigateToTutorials();
  }
}
