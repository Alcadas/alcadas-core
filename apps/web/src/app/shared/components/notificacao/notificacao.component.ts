import { Component, inject, signal } from '@angular/core';
import { NotificacaoService } from './notificacao.service';

@Component({
  selector: 'app-notificacoes',
  standalone: true,
  template: `
    <div class="pilha" aria-live="polite">
      @for (n of servico.itens(); track n.id) {
        <div class="toast" role="status">
          <div class="icone" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </div>
          <div class="corpo">
            <strong class="titulo">{{ n.titulo }}</strong>
            <p class="mensagem">{{ n.mensagem }}</p>
            @if (n.destaque) {
              <div class="destaque">
                <span class="codigo">{{ n.destaque }}</span>
                <button type="button" class="copiar" (click)="copiar(n.id, n.destaque)">
                  {{ copiado() === n.id ? 'Copiado!' : 'Copiar' }}
                </button>
              </div>
            }
          </div>
          <button type="button" class="fechar" aria-label="Fechar notificação" (click)="servico.fechar(n.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .pilha {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(360px, calc(100vw - 32px));
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    .toast {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 16px;
      border-radius: 18px;
      background: #fff;
      color: #1b1740;
      box-shadow: 0 18px 50px rgba(27, 23, 64, 0.18);
      border: 1px solid #e4e1fb;
      animation: entrar 0.25s ease-out;
    }
    .icone {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #efedff;
      color: #5a45ee;
    }
    .corpo { flex: 1; min-width: 0; }
    .titulo { display: block; font-size: 14px; font-weight: 800; }
    .mensagem { margin: 4px 0 0; font-size: 13px; line-height: 1.4; color: #5a5680; overflow-wrap: anywhere; }
    .destaque {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 10px;
      padding: 8px 8px 8px 14px;
      border-radius: 12px;
      background: #f8f8fc;
      border: 1.5px dashed #cfcbea;
    }
    .codigo { font-size: 22px; font-weight: 800; letter-spacing: 6px; font-variant-numeric: tabular-nums; }
    .copiar {
      padding: 6px 12px;
      border: 0;
      border-radius: 999px;
      background: #5a45ee;
      color: #fff;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .copiar:hover { background: #4b36d6; }
    .fechar {
      flex: none;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 50%;
      background: none;
      color: #5a5680;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
    .fechar:hover { background: #efedff; }
    .copiar:focus-visible, .fechar:focus-visible { outline: 3px solid #b5b7f5; outline-offset: 2px; }
    @keyframes entrar {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `,
})
export class NotificacoesComponent {
  protected readonly servico = inject(NotificacaoService);
  protected readonly copiado = signal<number | null>(null);

  copiar(id: number, texto: string): void {
    navigator.clipboard?.writeText(texto).then(
      () => this.copiado.set(id),
      () => undefined,
    );
  }
}
