import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RecuperacaoSenhaService } from '../../services/recuperacao-senha.service';

export const TAMANHO_MINIMO_SENHA = 6;

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
      senha: [
        '',
        [
          Validators.required,
          Validators.minLength(TAMANHO_MINIMO_SENHA),
          Validators.pattern(/[A-Za-z]/),
          Validators.pattern(/\d/),
        ],
      ],
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
    const senha = this.form.controls.senha.value;
    return {
      tamanho: senha.length >= TAMANHO_MINIMO_SENHA,
      letra: /[A-Za-z]/.test(senha),
      numero: /\d/.test(senha),
    };
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
