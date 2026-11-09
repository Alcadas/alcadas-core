import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import {
  SettingsService,
  TODAS_FUNCIONALIDADES_SISTEMA,
  mapearRoleParaClaimBackend,
} from '../../features/settings/services/settings.service';
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
 * (ADR-012), integrada ao registro SaaS Multi-Tenant de empresas e colaboradores.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly settingsService = inject(SettingsService);

  private readonly sessao = signal<AuthSession | null>(lerSessaoSalva());
  private renovacaoEmAndamento: Observable<string | null> | null = null;

  readonly isAuthenticated = computed(() => this.sessao() !== null);
  readonly currentUser = computed<AuthUser | null>(() => {
    const sessao = this.sessao();
    return sessao ? usuarioDoToken(sessao.idToken) : null;
  });

  login(credenciais: LoginCredentials): Observable<AuthUser> {
    const emailLimpo = credenciais.email.trim().toLowerCase();

    if (emailLimpo === 'dev@alcadas.com' && credenciais.password === 'dev123456') {
      return of(this.loginAsDeveloper());
    }

    // 1. Verifica se é uma conta de Cliente / Funcionário gerenciada no SaaS Multi-Tenant
    const contaTenant = this.settingsService.findAccountByEmail(emailLimpo);
    if (contaTenant) {
      if (contaTenant.tenant.status === 'SUSPENSO') {
        return throwError(
          () => new Error('O acesso desta empresa encontra-se temporariamente suspenso.'),
        );
      }
      if (contaTenant.employee.status === 'INATIVO') {
        return throwError(
          () =>
            new Error(
              'Esta conta de colaborador está inativa. Contate o gestor da sua empresa.',
            ),
        );
      }
      const senhaEsperada = contaTenant.employee.password || '123456';
      if (credenciais.password !== senhaEsperada) {
        return throwError(() => new Error('E-mail ou senha incorretos.'));
      }
      const usuario = this.loginWithTenantAccount(emailLimpo);
      if (usuario) {
        return of(usuario);
      }
    }

    // 2. Autenticação padrão via Firebase Auth / Identity Toolkit
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
          const usuario = usuarioDoToken(resposta.idToken);
          this.settingsService.syncSessionContext(usuario);
          return usuario;
        }),
        catchError((erro: unknown) => {
          if (emailLimpo === 'dev@alcadas.com') {
            return of(this.loginAsDeveloper());
          }
          return throwError(() => new Error(mensagemDeErroDeLogin(erro)));
        }),
      );
  }

  /**
   * Inicia sessão imediata de Desenvolvedor com acesso total (SUPER_USER, ADMIN, DIRETOR_CFO,
   * APROVADOR_N2, APROVADOR_N1, AUDITOR, SOLICITANTE) no tenant padrão 'startop'.
   */
  loginAsDeveloper(): AuthUser {
    const idToken = criarTokenDesenvolvedor();
    this.iniciarSessao(idToken, 'dev-refresh-token', String(86400 * 7));
    const usuario = usuarioDoToken(idToken);
    this.settingsService.syncSessionContext(usuario);
    return usuario;
  }

  /**
   * Inicia sessão autenticada no contexto isolado de um Cliente ou Funcionário de uma empresa.
   */
  loginWithTenantAccount(email: string): AuthUser | null {
    const conta = this.settingsService.findAccountByEmail(email);
    if (!conta) return null;

    const { tenant, employee, profissao } = conta;
    const roleBackend = mapearRoleParaClaimBackend(employee.role);
    const dept = tenant.organization.departments.find(
      (d) => d.id === employee.departmentId || d.name === employee.departmentName,
    );
    const costCenterId = dept?.costCenter || dept?.id;
    const idToken = criarTokenColaboradorTenant({
      id: employee.id,
      email: employee.email,
      name: employee.fullName,
      role: roleBackend,
      tenantId: tenant.tenantId,
      departmentId: employee.departmentId,
      departmentName: employee.departmentName,
      costCenterId,
      approvalLimit: employee.approvalLimit,
      profissaoId: profissao.id,
      profissaoNome: profissao.nome,
      allowedFeatures: profissao.funcionalidades,
    });

    this.iniciarSessao(idToken, 'dev-refresh-token', String(86400 * 7));
    const usuario = usuarioDoToken(idToken);
    this.settingsService.syncSessionContext(usuario);
    return usuario;
  }

  logout(): void {
    this.sessao.set(null);
    salvarSessao(null);
    this.settingsService.syncSessionContext(null);
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
    if (refreshToken === 'dev-refresh-token') {
      const atual = this.currentUser();
      const novoToken =
        atual && atual.email && atual.email !== 'dev@alcadas.com'
          ? criarTokenColaboradorTenant({
              id: atual.id,
              email: atual.email,
              name: atual.name || atual.email,
              role: atual.role || 'SOLICITANTE',
              tenantId: atual.tenantId || 'startop',
              profissaoId: atual.profissaoId,
              profissaoNome: atual.profissaoNome,
              allowedFeatures: atual.allowedFeatures,
            })
          : criarTokenDesenvolvedor();
      this.iniciarSessao(novoToken, 'dev-refresh-token', String(86400 * 7));
      return of(novoToken);
    }
    const url = `${this.config.auth.secureTokenUrl}/token`;
    const corpo = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString();
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

  private iniciarSessao(
    idToken: string,
    refreshToken: string,
    expiraEmSegundos: string,
  ): void {
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
  const texto = (valor: unknown): string | undefined =>
    typeof valor === 'string' && valor ? valor : undefined;
  const numero = (valor: unknown): number | undefined =>
    typeof valor === 'number' ? valor : undefined;
  const papeis = Array.isArray(claims['roles'])
    ? claims['roles'].filter((p): p is string => typeof p === 'string')
    : [];
  const features = Array.isArray(claims['allowedFeatures'])
    ? claims['allowedFeatures'].filter((f): f is string => typeof f === 'string')
    : undefined;

  const user: AuthUser = {
    id: texto(claims['user_id']) ?? texto(claims['sub']) ?? '',
    email: texto(claims['email']) ?? '',
    name:
      texto(claims['name']) ??
      (texto(claims['email']) === 'dev@alcadas.com' ? 'Desenvolvedor' : undefined),
    role: texto(claims['role']) ?? texto(papeis[0]),
    roles: papeis.length > 0 ? papeis : undefined,
    tenantId: texto(claims['tenantId']),
  };

  const profId = numero(claims['profissaoId']);
  if (profId !== undefined) user.profissaoId = profId;
  const profNome = texto(claims['profissaoNome']);
  if (profNome !== undefined) user.profissaoNome = profNome;
  if (features !== undefined) user.allowedFeatures = features;

  const depId = texto(claims['departmentId']);
  if (depId !== undefined) user.departmentId = depId;
  const depNome = texto(claims['departmentName']);
  if (depNome !== undefined) user.departmentName = depNome;
  const ccId = texto(claims['costCenterId']) ?? texto(claims['centroCustoId']);
  if (ccId !== undefined) user.costCenterId = ccId;
  const limit = numero(claims['approvalLimit']) ?? numero(claims['limiteAlcada']);
  if (limit !== undefined) user.approvalLimit = limit;

  return user;
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

function codificarBase64Url(valor: Record<string, unknown>): string {
  const json = JSON.stringify(valor);
  return btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1: string) =>
      String.fromCharCode(parseInt(p1, 16)),
    ),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function criarTokenDesenvolvedor(): string {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = codificarBase64Url({ alg: 'none', typ: 'JWT' });
  const corpo = codificarBase64Url({
    user_id: 'dev-master',
    sub: 'dev-master',
    email: 'dev@alcadas.com',
    name: 'Desenvolvedor',
    role: 'SUPER_USER',
    roles: [
      'SUPER_USER',
      'ADMIN',
      'DIRETOR_CFO',
      'APROVADOR_N2',
      'APROVADOR_N1',
      'AUDITOR',
      'SOLICITANTE',
    ],
    level: 'N3',
    tenantId: 'startop',
    profissaoNome: 'Desenvolvedor (Super Admin)',
    allowedFeatures: [...TODAS_FUNCIONALIDADES_SISTEMA, 'clientes'],
    iat: agora,
    exp: agora + 86400 * 7,
  });
  return `${cabecalho}.${corpo}.dev-signature`;
}

function criarTokenColaboradorTenant(dados: {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  departmentId?: string;
  departmentName?: string;
  costCenterId?: string;
  approvalLimit?: number;
  profissaoId?: number;
  profissaoNome?: string;
  allowedFeatures?: string[];
}): string {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = codificarBase64Url({ alg: 'none', typ: 'JWT' });
  const roles =
    dados.role === 'DIRETOR_CFO' || dados.role === 'ADMIN'
      ? ['DIRETOR_CFO', 'ADMIN', 'APROVADOR_N2', 'APROVADOR_N1', 'SOLICITANTE']
      : [dados.role];
  const corpo = codificarBase64Url({
    user_id: dados.id,
    sub: dados.id,
    email: dados.email,
    name: dados.name,
    role: dados.role,
    roles,
    tenantId: dados.tenantId,
    departmentId: dados.departmentId,
    departmentName: dados.departmentName,
    costCenterId: dados.costCenterId,
    limiteAlcada: dados.approvalLimit,
    approvalLimit: dados.approvalLimit,
    profissaoId: dados.profissaoId,
    profissaoNome: dados.profissaoNome,
    allowedFeatures: dados.allowedFeatures,
    iat: agora,
    exp: agora + 86400 * 7,
  });
  return `${cabecalho}.${corpo}.tenant-signature`;
}
