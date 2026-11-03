import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
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
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set('Informe e-mail e senha para entrar.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.loginForm.getRawValue();

    this.authService.login({ email: email.trim(), password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: (erro: Error) => {
        this.isLoading.set(false);
        this.errorMessage.set(erro.message);
      },
    });
  }

  enterAsDeveloper(): void {
    this.errorMessage.set(null);
    if (typeof this.authService.loginAsDeveloper === 'function') {
      this.authService.loginAsDeveloper();
      void this.router.navigate(['/dashboard']);
      return;
    }

    this.loginForm.patchValue({
      email: 'dev@alcadas.com',
      password: 'dev123456',
    });
    this.onSubmit();
  }
}
