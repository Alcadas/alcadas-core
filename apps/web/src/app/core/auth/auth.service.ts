import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthResponse, AuthUser, LoginCredentials } from './auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api';

  private readonly currentUserSignal = signal<AuthUser | null>(null);
  private readonly tokenSignal = signal<string | null>(localStorage.getItem('auth_token'));

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.tokenSignal());

  constructor() {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken && !this.currentUserSignal()) {
      // Restaura sessão mock inicial se já houver token salvo
      this.currentUserSignal.set({
        id: 'usr-admin-01',
        email: 'gestor@organizacao.com',
        name: 'Gestor Financeiro',
        role: 'APROVADOR_TITULAR',
      });
    }
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap((response) => {
        this.tokenSignal.set(response.token);
        this.currentUserSignal.set(response.user);
        localStorage.setItem('auth_token', response.token);
      })
    );
  }

  setMockSession(email: string): void {
    const mockUser: AuthUser = {
      id: 'mock-user-1',
      email: email || 'gestor@organizacao.com',
      name: (email.split('@')[0] || 'Gestor').toUpperCase(),
      role: 'APROVADOR_TITULAR',
    };
    const mockToken = 'mock-jwt-token-alcadas-' + Date.now();
    this.tokenSignal.set(mockToken);
    this.currentUserSignal.set(mockUser);
    localStorage.setItem('auth_token', mockToken);
  }

  logout(): void {
    this.tokenSignal.set(null);
    this.currentUserSignal.set(null);
    localStorage.removeItem('auth_token');
  }

  getToken(): string | null {
    return this.tokenSignal();
  }
}
