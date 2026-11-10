import { Injectable, signal } from '@angular/core';

export interface Notificacao {
  id: number;
  titulo: string;
  mensagem: string;
  /** Texto em destaque (ex.: o código de verificação), com botão de copiar. */
  destaque?: string;
}

const DURACAO_PADRAO_MS = 15_000;

/** Notificações (toasts) exibidas no canto da tela, independentes da rota atual. */
@Injectable({ providedIn: 'root' })
export class NotificacaoService {
  private proximoId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly itens = signal<Notificacao[]>([]);

  mostrar(dados: Omit<Notificacao, 'id'>, duracaoMs = DURACAO_PADRAO_MS): number {
    const id = this.proximoId++;
    this.itens.update((lista) => [...lista, { id, ...dados }]);
    this.timers.set(id, setTimeout(() => this.fechar(id), duracaoMs));
    return id;
  }

  fechar(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.itens.update((lista) => lista.filter((n) => n.id !== id));
  }
}
