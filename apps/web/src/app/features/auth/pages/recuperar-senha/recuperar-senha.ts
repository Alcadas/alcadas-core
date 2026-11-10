import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RecuperacaoSenhaService } from '../../services/recuperacao-senha.service';

@Component({
  selector: 'app-recuperar-senha',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './recuperar-senha.html',
  styleUrls: ['./recuperar-senha.css'],
})
export class RecuperarSenha {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly recuperacao = inject(RecuperacaoSenhaService);

  readonly erro = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get emailInvalido(): boolean {
    const c = this.form.controls.email;
    return c.invalid && (c.touched || c.dirty);
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const email = this.form.controls.email.value.trim().toLowerCase();
    try {
      this.recuperacao.solicitarCodigo(email);
      this.erro.set('');
      this.router.navigate(['/verificarCodigo']);
    } catch (e) {
      this.erro.set((e as Error).message);
    }
  }
}
