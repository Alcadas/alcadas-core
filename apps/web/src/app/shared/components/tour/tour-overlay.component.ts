import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourService } from '../../../core/services/tour.service';

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (tourService.isTourActive() && tourService.currentStep(); as step) {
      <div
        class="tour-overlay-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        <!-- Card do Passo Interativo -->
        <div class="tour-card" [class]="'pos-' + (step.position || 'center')">
          <!-- Barra de Progresso Superior -->
          <div class="tour-progress-bar">
            <div
              class="tour-progress-fill"
              [style.width.%]="tourService.progressPercentage()"
            ></div>
          </div>

          <!-- Cabeçalho do Card -->
          <div class="tour-card-header">
            <div class="header-badge-group">
              <span class="step-counter">
                Passo {{ tourService.currentStepIndex() + 1 }} de {{ tourService.tourSteps().length }}
              </span>
              @if (step.badge) {
                <span class="context-badge">{{ step.badge }}</span>
              }
            </div>

            <button
              type="button"
              class="btn-close-tour"
              aria-label="Encerrar tour interativo"
              title="Encerrar tour (Esc)"
              (click)="fecharTour()"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <!-- Conteúdo do Passo -->
          <div class="tour-card-body">
            <div class="step-title-row">
              @if (step.icon) {
                <div class="step-icon-box">
                  <span class="material-symbols-rounded">{{ step.icon }}</span>
                </div>
              }
              <h3 id="tour-step-title" class="step-title">{{ step.title }}</h3>
            </div>

            <p class="step-description">{{ step.description }}</p>

            @if (step.actionHint) {
              <div class="step-hint-box">
                <span class="material-symbols-rounded hint-icon">lightbulb</span>
                <span class="hint-text">{{ step.actionHint }}</span>
              </div>
            }
          </div>

          <!-- Rodapé com Navegação -->
          <div class="tour-card-footer">
            <button
              type="button"
              class="btn-skip-tour"
              (click)="fecharTour()"
            >
              Pular tour
            </button>

            <div class="nav-buttons-group">
              <button
                type="button"
                class="btn-tour-nav"
                [disabled]="tourService.isFirstStep()"
                (click)="anterior()"
                title="Passo anterior"
              >
                <span class="material-symbols-rounded">arrow_back</span>
                <span>Anterior</span>
              </button>

              <button
                type="button"
                class="btn-tour-primary"
                (click)="proximo()"
              >
                <span>{{ tourService.isLastStep() ? 'Concluir Tour' : 'Próximo' }}</span>
                <span class="material-symbols-rounded">
                  {{ tourService.isLastStep() ? 'check' : 'arrow_forward' }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .tour-overlay-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
      z-index: 10000;
      pointer-events: auto;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 1.5rem;
      animation: fadeIn 0.15s ease-out;

      @media (min-width: 768px) {
        align-items: center;
      }
    }

    .tour-card {
      width: 100%;
      max-width: 480px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.25), 0 8px 10px -6px rgba(15, 23, 42, 0.2), 0 0 0 1px #e2e8f0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: slideInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .tour-progress-bar {
      width: 100%;
      height: 4px;
      background: #f1f5f9;

      .tour-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #644ef3 0%, #38bdf8 100%);
        transition: width 0.25s ease;
      }
    }

    .tour-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem 0.5rem;

      .header-badge-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .step-counter {
        font-size: 0.75rem;
        font-weight: 700;
        color: #644ef3;
        background: #f1eeff;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
      }

      .context-badge {
        font-size: 0.72rem;
        font-weight: 600;
        color: #475569;
        background: #f1f5f9;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
      }

      .btn-close-tour {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          color: #0f172a;
          background: #f1f5f9;
        }

        .material-symbols-rounded {
          font-size: 20px;
        }
      }
    }

    .tour-card-body {
      padding: 0.75rem 1.25rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      .step-title-row {
        display: flex;
        align-items: center;
        gap: 0.65rem;

        .step-icon-box {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #f1eeff;
          color: #644ef3;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          .material-symbols-rounded {
            font-size: 18px;
          }
        }

        .step-title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
        }
      }

      .step-description {
        margin: 0;
        font-size: 0.875rem;
        color: #475569;
        line-height: 1.5;
      }

      .step-hint-box {
        display: flex;
        align-items: flex-start;
        gap: 0.45rem;
        padding: 0.55rem 0.75rem;
        border-radius: 8px;
        background: #fefce8;
        border: 1px solid #fef08a;
        color: #854d0e;
        font-size: 0.78rem;

        .hint-icon {
          font-size: 16px;
          color: #ca8a04;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .hint-text {
          line-height: 1.4;
        }
      }
    }

    .tour-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.9rem 1.25rem 1.15rem;
      border-top: 1px solid #f1f5f9;
      background: #fafbfd;

      .btn-skip-tour {
        background: transparent;
        border: none;
        color: #64748b;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;

        &:hover {
          color: #0f172a;
          text-decoration: underline;
        }
      }

      .nav-buttons-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .btn-tour-nav {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.45rem 0.75rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #334155;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;

        &:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .material-symbols-rounded {
          font-size: 16px;
        }
      }

      .btn-tour-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.45rem 1rem;
        border-radius: 8px;
        border: none;
        background: #644ef3;
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #503cd1;
        }

        .material-symbols-rounded {
          font-size: 16px;
        }
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideInUp {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `],
})
export class TourOverlayComponent {
  readonly tourService = inject(TourService);

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.tourService.isTourActive()) {
      this.fecharTour();
    }
  }

  @HostListener('window:keydown.arrowright')
  onArrowRight(): void {
    if (this.tourService.isTourActive()) {
      this.proximo();
    }
  }

  @HostListener('window:keydown.arrowleft')
  onArrowLeft(): void {
    if (this.tourService.isTourActive()) {
      this.anterior();
    }
  }

  proximo(): void {
    this.tourService.nextStep();
  }

  anterior(): void {
    this.tourService.prevStep();
  }

  fecharTour(): void {
    this.tourService.endTour();
  }
}
