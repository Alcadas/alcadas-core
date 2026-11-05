import { AppConfig } from '../app/core/config/app-config.model';

/**
 * Desenvolvimento local: `docker compose up` (API em :3000 via proxy `/api`
 * e Firebase Auth Emulator em :9099). O emulador aceita qualquer `apiKey`.
 */
export const environment: AppConfig = {
  apiBaseUrl: 'http://localhost:3000/api',
  auth: {
    apiKey: 'demo-alcadas',
    identityToolkitUrl: 'http://localhost:9099/identitytoolkit.googleapis.com/v1',
    secureTokenUrl: 'http://localhost:9099/securetoken.googleapis.com/v1',
  },
};
