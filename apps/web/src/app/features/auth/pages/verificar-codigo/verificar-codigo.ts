import {
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject,
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-verificar-codigo',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './verificar-codigo.html',
  styleUrls: ['./verificar-codigo.css'],
})
export class VerificarCodigo implements OnDestroy {
  private router = inject(Router);

  @ViewChildren('caixa') caixas!: QueryList<ElementRef<HTMLInputElement>>;

  /** E-mail vindo da tela anterior (router state). */
  email: string = history.state?.email ?? '';

  digitos: string[] = ['', '', '', '', '', ''];
  erro = '';
  carregando = false;
  segundos = 30;

  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    this.iniciarContagem();
  }

  get completo(): boolean {
    return this.digitos.every((d) => d !== '');
  }

  porIndice(i: number): number {
    return i;
  }

  digitar(ev: Event, i: number): void {
    const el = ev.target as HTMLInputElement;
    const n = el.value.replace(/\D/g, '');

    if (n.length > 1) {
      this.preencher(n, i);
      return;
    }
    this.digitos[i] = n;
    el.value = n;
    this.erro = '';
    if (n && i < 5) this.focar(i + 1);
  }

  teclar(ev: KeyboardEvent, i: number): void {
    if (ev.key === 'Backspace' && !this.digitos[i] && i > 0) {
      this.digitos[i - 1] = '';
      this.focar(i - 1);
    } else if (ev.key === 'ArrowLeft' && i > 0) {
      this.focar(i - 1);
    } else if (ev.key === 'ArrowRight' && i < 5) {
      this.focar(i + 1);
    }
  }

  colar(ev: ClipboardEvent): void {
    ev.preventDefault();
    this.preencher(ev.clipboardData?.getData('text') ?? '', 0);
  }

  verificar(ev: Event): void {
    ev.preventDefault();
    if (!this.completo) return;

    this.carregando = true;
    this.erro = '';
    const codigo = this.digitos.join('');

    // TODO: chamar o backend (NestJS) para validar o código.
    // Se for válido, ele devolve um token de redefinição; envie-o para a próxima tela.
    // Se for inválido ou expirado: this.erro = 'Código inválido ou expirado.'
    console.log('código informado:', codigo);

    this.carregando = false;
    this.router.navigate(['/nova-senha'], { state: { email: this.email, codigo } });
  }

  reenviar(): void {
    if (this.segundos > 0) return;
    // TODO: pedir ao backend para enviar um novo código.
    this.digitos = ['', '', '', '', '', ''];
    this.erro = '';
    this.focar(0);
    this.iniciarContagem();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private preencher(texto: string, inicio: number): void {
    const n = texto.replace(/\D/g, '').slice(0, 6 - inicio);
    n.split('').forEach((c, k) => (this.digitos[inicio + k] = c));
    this.erro = '';
    this.focar(Math.min(inicio + n.length, 5));
  }

  private focar(i: number): void {
    const el = this.caixas.get(i)?.nativeElement;
    el?.focus();
    el?.select();
  }

  private iniciarContagem(): void {
    clearInterval(this.timer);
    this.segundos = 30;
    this.timer = setInterval(() => {
      this.segundos--;
      if (this.segundos <= 0) clearInterval(this.timer);
    }, 1000);
  }
}
