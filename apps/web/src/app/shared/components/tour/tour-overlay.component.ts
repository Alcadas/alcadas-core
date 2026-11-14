import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourService } from '../../../core/services/tour.service';

export interface TargetBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (tourService.isTourActive() && tourService.currentStep(); as step) {
      <div
        class="tour-overlay-wrapper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        @if (targetBox(); as box) {
          <!-- 4 Painéis Escuros e em Blur cercando o elemento em foco -->
          <!-- Painel Superior (de 0 até box.top) -->
          <div
            class="tour-backdrop-panel panel-top"
            [style.height.px]="box.top"
          ></div>

          <!-- Painel Inferior (de box.top + box.height até o fim da tela) -->
          <div
            class="tour-backdrop-panel panel-bottom"
            [style.top.px]="box.top + box.height"
          ></div>

          <!-- Painel Esquerdo (entre box.top e box.bottom, de 0 até box.left) -->
          <div
            class="tour-backdrop-panel panel-left"
            [style.top.px]="box.top"
            [style.height.px]="box.height"
            [style.width.px]="box.left"
          ></div>

          <!-- Painel Direito (entre box.top e box.bottom, de box.left + box.width até a borda direita) -->
          <div
            class="tour-backdrop-panel panel-right"
            [style.top.px]="box.top"
            [style.height.px]="box.height"
            [style.left.px]="box.left + box.width"
          ></div>

          <!-- Moldura iluminada e pulsante do elemento focado -->
          <div
            class="tour-spotlight-frame"
            [style.top.px]="box.top"
            [style.left.px]="box.left"
            [style.width.px]="box.width"
            [style.height.px]="box.height"
          ></div>
        } @else {
          <!-- Se não houver elemento no passo, fundo inteiro escuro com blur -->
          <div class="tour-backdrop-panel panel-fullscreen"></div>
        }

        <!-- Card Flutuante de Instrução -->
        <div
          class="tour-card"
          [class.has-target]="!!targetBox()"
          [ngStyle]="cardStyle()"
        >
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
    .tour-overlay-wrapper {
      position: fixed;
      inset: 0;
      z-index: 10000;
      pointer-events: auto;
      animation: fadeIn 0.18s ease-out;
    }

    .tour-backdrop-panel {
      position: fixed;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(2.5px);
      -webkit-backdrop-filter: blur(2.5px);
      z-index: 10000;
      pointer-events: auto;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .panel-top {
      top: 0;
      left: 0;
      right: 0;
    }

    .panel-bottom {
      left: 0;
      right: 0;
      bottom: 0;
    }

    .panel-left {
      left: 0;
    }

    .panel-right {
      right: 0;
    }

    .panel-fullscreen {
      inset: 0;
    }

    .tour-spotlight-frame {
      position: fixed;
      border-radius: 10px;
      border: 2.5px solid #644ef3;
      box-shadow: 0 0 0 4px rgba(100, 78, 243, 0.35), 0 0 24px rgba(100, 78, 243, 0.5);
      pointer-events: auto;
      cursor: default;
      z-index: 10001;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      animation: pulseGlow 2.5s infinite ease-in-out;
    }

    @keyframes pulseGlow {
      0%, 100% {
        box-shadow: 0 0 0 3px rgba(100, 78, 243, 0.3), 0 0 16px rgba(100, 78, 243, 0.4);
      }
      50% {
        box-shadow: 0 0 0 6px rgba(100, 78, 243, 0.5), 0 0 28px rgba(100, 78, 243, 0.7);
      }
    }

    .tour-card {
      width: 100%;
      max-width: 460px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 35px -5px rgba(15, 23, 42, 0.3), 0 10px 15px -6px rgba(15, 23, 42, 0.2), 0 0 0 1px #e2e8f0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: slideInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      transition: top 0.2s ease, left 0.2s ease;
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

  readonly targetBox = signal<TargetBox | null>(null);
  readonly cardStyle = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const active = this.tourService.isTourActive();
      // Track index so effect re-runs when step changes
      this.tourService.currentStepIndex();

      if (active) {
        this.refreshSpotlight();
        setTimeout(() => this.refreshSpotlight(), 100);
        setTimeout(() => this.refreshSpotlight(), 280);
      } else {
        this.targetBox.set(null);
      }
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.tourService.isTourActive()) {
      this.refreshSpotlight();
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.tourService.isTourActive()) {
      this.refreshSpotlight();
    }
  }

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

  refreshSpotlight(): void {
    if (typeof window === 'undefined') return;
    const step = this.tourService.currentStep();
    if (!step || !step.targetSelector) {
      this.targetBox.set(null);
      this.calculateCardPosition(null);
      return;
    }

    try {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          this.targetBox.set(null);
          this.calculateCardPosition(null);
          return;
        }

        const pad = 6;
        const top = Math.max(0, Math.floor(r.top - pad));
        const left = Math.max(0, Math.floor(r.left - pad));
        const width = Math.min(window.innerWidth - left, Math.ceil(r.width + pad * 2));
        const height = Math.min(window.innerHeight - top, Math.ceil(r.height + pad * 2));

        const box: TargetBox = { top, left, width, height };
        this.targetBox.set(box);
        this.calculateCardPosition(box);
      } else {
        this.targetBox.set(null);
        this.calculateCardPosition(null);
      }
    } catch {
      this.targetBox.set(null);
      this.calculateCardPosition(null);
    }
  }

  calculateCardPosition(box: TargetBox | null): void {
    if (typeof window === 'undefined') return;

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      this.cardStyle.set({
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: '10002',
      });
      return;
    }

    if (!box) {
      this.cardStyle.set({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '460px',
        maxWidth: '90vw',
        zIndex: '10002',
      });
      return;
    }

    const step = this.tourService.currentStep();
    const pref = step?.position || 'bottom';
    const cardWidth = 440;
    const cardHeight = 260;
    const gap = 16;

    let top = 0;
    let left = 0;

    if (pref === 'right' || (box.left < window.innerWidth / 3 && pref !== 'left')) {
      left = box.left + box.width + gap;
      top = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, box.top));
      if (left + cardWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - cardWidth - 16);
        top = Math.min(window.innerHeight - cardHeight - 16, box.top + box.height + gap);
      }
    } else if (pref === 'left' || box.left > (window.innerWidth * 2) / 3) {
      left = Math.max(16, box.left - cardWidth - gap);
      top = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, box.top));
    } else if (pref === 'bottom' || box.top < 220) {
      top = box.top + box.height + gap;
      left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, box.left));
      if (top + cardHeight > window.innerHeight - 16) {
        top = Math.max(16, box.top - cardHeight - gap);
      }
    } else {
      top = Math.max(16, box.top - cardHeight - gap);
      left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, box.left));
    }

    this.cardStyle.set({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardWidth}px`,
      maxWidth: 'calc(100vw - 32px)',
      zIndex: '10002',
    });
  }

  proximo(): void {
    void this.tourService.nextStep();
  }

  anterior(): void {
    void this.tourService.prevStep();
  }

  fecharTour(): void {
    this.tourService.endTour();
  }
}
