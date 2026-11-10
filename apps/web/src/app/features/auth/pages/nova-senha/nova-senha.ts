import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { requisitosDaSenha, validadoresDeSenha } from '../../../../core/auth/senha';
import { RecuperacaoSenhaService } from '../../services/recuperacao-senha.service';

function senhasIguais(g: AbstractControl): ValidationErrors | null {
  return g.get('senha')?.value === g.get('confirmar')?.value ? null : { diferentes: true };
}

@Component({
  selector: 'app-nova-senha',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './nova-senha.html',
  styleUrls: ['./nova-senha.css'],
})
export class NovaSenha {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private recuperacao = inject(RecuperacaoSenhaService);

  carregando = false;
  concluido = false;
  erro = '';

  form = this.fb.nonNullable.group(
    {
      senha: ['', validadoresDeSenha],
      confirmar: ['', Validators.required],
    },
    { validators: senhasIguais },
  );

  constructor() {
    if (!this.recuperacao.podeRedefinir()) {
      // Só chega aqui depois de confirmar o código.
      this.router.navigate(['/recuperar-senha']);
    }
  }

  get req() {
    return requisitosDaSenha(this.form.controls.senha.value);
  }

  get diferentes(): boolean {
    const c = this.form.controls.confirmar;
    return this.form.hasError('diferentes') && (c.touched || c.dirty);
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.carregando = true;
    this.erro = '';
    try {
      this.recuperacao.redefinirSenha(this.form.controls.senha.value);
      this.concluido = true;
    } catch (e) {
      this.erro = (e as Error).message;
    } finally {
      this.carregando = false;
    }
  }
}
