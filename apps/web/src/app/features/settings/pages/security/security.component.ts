import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  DESCRICAO_REGRA_SENHA,
  requisitosDaSenha,
  validadoresDeSenha,
} from '../../../../core/auth/senha';
import { SettingsService } from '../../services/settings.service';

function passwordMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss',
})
export class SecurityComponent {
  private readonly fb = inject(FormBuilder);
  private readonly settings = inject(SettingsService);

  readonly regraSenha = DESCRICAO_REGRA_SENHA;
  readonly erroSenha = signal('');

  readonly activeTab = signal<'password' | '2fa' | 'sessions'>('password');
  readonly saved = signal(false);
  readonly twoFactorEnabled = signal(true);
  readonly biometricApproval = signal(true);

  readonly sessions = signal([
    {
      id: 'sess-1',
      device: 'Linux Workstation · Chrome 131',
      ip: '189.6.214.88 · Brasília, DF',
      lastActive: 'Sessão atual (Ativa agora)',
      current: true,
    },
    {
      id: 'sess-2',
      device: 'iPhone 16 Pro · App Alçadas Mobile',
      ip: '177.84.19.104 · Brasília, DF',
      lastActive: 'Há 2 horas',
      current: false,
    },
  ]);

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', validadoresDeSenha],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatch },
  );

  get req() {
    return requisitosDaSenha(this.form.controls.newPassword.value);
  }

  save(): void {
    this.saved.set(false);
    this.erroSenha.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    try {
      this.settings.alterarSenhaDaContaLogada(currentPassword, newPassword);
      this.form.reset();
      this.saved.set(true);
    } catch (e) {
      this.erroSenha.set((e as Error).message);
    }
  }

  /** Limpa os avisos quando o usuário volta a digitar. */
  limparAvisos(): void {
    this.saved.set(false);
    this.erroSenha.set('');
  }

  revokeSession(id: string): void {
    this.sessions.update((list) => list.filter((s) => s.id !== id));
  }

  invalid(name: 'currentPassword' | 'newPassword' | 'confirmPassword'): boolean {
    const c = this.form.controls[name];
    return c.touched && c.invalid;
  }
}
