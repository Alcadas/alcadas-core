import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

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

  /** Dados vindos da tela do código (router state). */
  private email: string = history.state?.email ?? '';
  private codigo: string = history.state?.codigo ?? '';

  carregando = false;
  concluido = false;

  form = this.fb.nonNullable.group(
    {
      senha: ['', [Validators.required, Validators.minLength(8)]],
      confirmar: ['', Validators.required],
    },
    { validators: senhasIguais },
  );

  get req() {
    return {
      tamanho: this.form.controls.senha.value.length >= 8,
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

    // TODO: enviar ao backend (NestJS) { email, codigo, novaSenha } para trocar a senha.
    // O backend deve validar o código de novo antes de alterar a senha.
    console.log({ email: this.email, codigo: this.codigo });

    this.carregando = false;
    this.concluido = true;
  }
}