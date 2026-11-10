import {
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RecuperacaoSenhaService } from '../../services/recuperacao-senha.service';

@Component({
  selector: 'app-verificar-codigo',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './verificar-codigo.html',
  styleUrls: ['./verificar-codigo.css'],
})

export class VerificarCodigo implements OnDestroy {
  private router = inject(Router);
  private recuperacao = inject(RecuperacaoSenhaService);

  @ViewChildren('caixa') caixas!: QueryList<ElementRef<HTMLInputElement>>;

  /** E-mail que está em recuperação (vem do RecuperacaoSenhaService). */
  email: string = this.recuperacao.emailPendente();

  digitos: string[] = ['', '', '', '', '', ''];
  erro = '';
  carregando = false;
  segundos = 30;

  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    if (!this.email) {
      // Entrou direto pela URL, sem pedir o código antes.
      this.router.navigate(['/recuperar-senha']);
      return;
    }
    this.iniciarContagem();
  }

  get completo(): boolean {
    return this.digitos.every((d) => d !== '');
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
    if (!this.completo || this.carregando) return;

    this.carregando = true;
    const resultado = this.recuperacao.verificarCodigo(this.digitos.join(''));
    this.carregando = false;

    if (!resultado.ok) {
      this.erro = resultado.erro;
      this.digitos = ['', '', '', '', '', ''];
      this.focar(0);
      return;
    }
    this.erro = '';
    this.router.navigate(['/novaSenha']);
  }

  reenviar(): void {
    if (this.segundos > 0) return;
    try {
      this.recuperacao.reenviarCodigo();
      this.digitos = ['', '', '', '', '', ''];
      this.erro = '';
      this.focar(0);
      this.iniciarContagem();
    } catch (e) {
      this.erro = (e as Error).message;
    }
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
    const el = this.caixas?.get(i)?.nativeElement;
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
