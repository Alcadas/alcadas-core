export interface DevAccessConfig {
  email: string;
  password: string;
}

/**
 * Configuração do frontend por ambiente (`src/environments`).
 * Não guarda segredos: a `apiKey` do Firebase Web é pública por definição.
 */
export interface AppConfig {
  /** Indica se a aplicação está rodando em ambiente de produção (`environment.production`). */
  production: boolean;
  /** Prefixo das rotas da API. Em desenvolvimento passa pelo proxy do dev-server. */
  apiBaseUrl: string;
  auth: {
    apiKey: string;
    /** Base da API REST do Firebase Auth (Identity Toolkit) — emulador ou produção. */
    identityToolkitUrl: string;
    /** Base do serviço de renovação de token (Secure Token) — emulador ou produção. */
    secureTokenUrl: string;
  };
  /** Credenciais de atalho de desenvolvimento local (ausente no bundle de produção). */
  devAccess?: DevAccessConfig;
}
