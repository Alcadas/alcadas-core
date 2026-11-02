export interface LoginCredentials {
  email: string;
  password: string;
}

/** Usuário logado, montado a partir das claims do ID token do Firebase Auth. */
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  /** Papel da custom claim `role` (ex.: SOLICITANTE, APROVADOR_N2) — ADR-007. */
  role?: string;
  /** Empresa do usuário (custom claim `tenantId`) — RNF07. */
  tenantId?: string;
}

/** Sessão guardada no sessionStorage enquanto a aba estiver aberta. */
export interface AuthSession {
  idToken: string;
  refreshToken: string;
  /** Instante (ms desde epoch) em que o ID token expira. */
  expiresAt: number;
}
