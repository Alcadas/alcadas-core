import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['gestor@organizacao.com', [Validators.email]],
    password: ['123456'],
  });

  onSubmit(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const email = this.loginForm.value.email?.trim() || 'gestor@organizacao.com';
    const password = this.loginForm.value.password || '123456';

    // Tenta autenticar na API se disponível; caso contrário, passa direto para o dashboard
    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        // Modo flexível / desenvolvimento: avança para a próxima tela mesmo sem API ou rota configurada no backend
        this.isLoading.set(false);
        this.authService.setMockSession(email);
        this.router.navigate(['/dashboard']);
      },
    });
  }
}
