import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { mensagemDeErroDeLogin } from './auth-errors';
import { AuthSession, AuthUser, LoginCredentials } from './auth.models';
import { lerClaimsDoJwt } from './jwt';

const CHAVE_SESSAO = 'alcadas.sessao';
/** Renova o ID token quando faltar menos que isso para expirar. */
const MARGEM_DE_RENOVACAO_MS = 60_000;

interface RespostaLogin {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface RespostaRenovacao {
  id_token: string;
  refresh_token: string;
  expires_in: string;
}

/**
 * Autenticação pelo Firebase Auth usando a API REST (Identity Toolkit), sem o SDK do Firebase
 * (ADR-012). Em desenvolvimento aponta para o Auth Emulator; em produção, para o Google.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  private readonly sessao = signal<AuthSession | null>(lerSessaoSalva());
  private renovacaoEmAndamento: Observable<string | null> | null = null;

  readonly isAuthenticated = computed(() => this.sessao() !== null);
  readonly currentUser = computed<AuthUser | null>(() => {
    const sessao = this.sessao();
    return sessao ? usuarioDoToken(sessao.idToken) : null;
  });

  login(credenciais: LoginCredentials): Observable<AuthUser> {
    const url = `${this.config.auth.identityToolkitUrl}/accounts:signInWithPassword`;
    return this.http
      .post<RespostaLogin>(
        url,
        { email: credenciais.email, password: credenciais.password, returnSecureToken: true },
        { params: { key: this.config.auth.apiKey } },
      )
      .pipe(
        map((resposta) => {
          this.iniciarSessao(resposta.idToken, resposta.refreshToken, resposta.expiresIn);
          return usuarioDoToken(resposta.idToken);
        }),
        catchError((erro: unknown) => throwError(() => new Error(mensagemDeErroDeLogin(erro)))),
      );
  }

  logout(): void {
    this.sessao.set(null);
    salvarSessao(null);
  }

  getToken(): string | null {
    return this.sessao()?.idToken ?? null;
  }

  /**
   * ID token pronto para ir à API. Renova pelo refresh token quando está para expirar;
   * se a renovação falhar, encerra a sessão e devolve null.
   */
  obterTokenValido(): Observable<string | null> {
    const sessao = this.sessao();
    if (!sessao) {
      return of(null);
    }
    if (sessao.expiresAt - Date.now() > MARGEM_DE_RENOVACAO_MS) {
      return of(sessao.idToken);
    }
    this.renovacaoEmAndamento ??= this.renovar(sessao.refreshToken);
    return this.renovacaoEmAndamento;
  }

  private renovar(refreshToken: string): Observable<string | null> {
    const url = `${this.config.auth.secureTokenUrl}/token`;
    const corpo = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString();
    return this.http
      .post<RespostaRenovacao>(url, corpo, {
        params: { key: this.config.auth.apiKey },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        map((resposta) => {
          this.iniciarSessao(resposta.id_token, resposta.refresh_token, resposta.expires_in);
          return resposta.id_token;
        }),
        catchError(() => {
          this.logout();
          return of(null);
        }),
        finalize(() => {
          this.renovacaoEmAndamento = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
  }

  private iniciarSessao(idToken: string, refreshToken: string, expiraEmSegundos: string): void {
    const sessao: AuthSession = {
      idToken,
      refreshToken,
      expiresAt: Date.now() + Number(expiraEmSegundos) * 1000,
    };
    this.sessao.set(sessao);
    salvarSessao(sessao);
  }
}

function usuarioDoToken(idToken: string): AuthUser {
  const claims = lerClaimsDoJwt(idToken) ?? {};
  const texto = (valor: unknown): string | undefined => (typeof valor === 'string' && valor ? valor : undefined);
  const papeis = Array.isArray(claims['roles']) ? claims['roles'] : [];
  return {
    id: texto(claims['user_id']) ?? texto(claims['sub']) ?? '',
    email: texto(claims['email']) ?? '',
    name: texto(claims['name']),
    role: texto(claims['role']) ?? texto(papeis[0]),
    tenantId: texto(claims['tenantId']),
  };
}

/** O sessionStorage pode estar indisponível (modo privado, bloqueio do navegador). */
function lerSessaoSalva(): AuthSession | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    const sessao: unknown = bruto ? JSON.parse(bruto) : null;
    return ehSessaoValida(sessao) ? sessao : null;
  } catch {
    return null;
  }
}

function salvarSessao(sessao: AuthSession | null): void {
  try {
    if (sessao) {
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    } else {
      sessionStorage.removeItem(CHAVE_SESSAO);
    }
  } catch {
    // Sem armazenamento a sessão vale só enquanto a página estiver aberta.
  }
}

function ehSessaoValida(valor: unknown): valor is AuthSession {
  if (!valor || typeof valor !== 'object') {
    return false;
  }
  const sessao = valor as Partial<AuthSession>;
  return (
    typeof sessao.idToken === 'string' &&
    typeof sessao.refreshToken === 'string' &&
    typeof sessao.expiresAt === 'number'
  );
}
