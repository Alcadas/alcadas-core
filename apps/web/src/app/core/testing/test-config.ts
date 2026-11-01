import { AppConfig } from '../config/app-config.model';

/** Configuração fixa usada nas specs (não depende de `src/environments`). */
export const CONFIG_DE_TESTE: AppConfig = {
  apiBaseUrl: '/api',
  auth: {
    apiKey: 'chave-teste',
    identityToolkitUrl: 'http://auth.teste/identitytoolkit.googleapis.com/v1',
    secureTokenUrl: 'http://auth.teste/securetoken.googleapis.com/v1',
  },
};
