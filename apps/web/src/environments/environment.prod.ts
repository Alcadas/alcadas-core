import { AppConfig } from '../app/core/config/app-config.model';

/**
 * Produção (Checkpoint 3 — Plano Custo Zero, ADR-011): frontend no Firebase Hosting chamando
 * a API publicada no Render.
 */
export const environment: AppConfig = {
  production: true,
  apiBaseUrl: 'https://alcadas-api.onrender.com/api',
  auth: {
    apiKey: '',
    identityToolkitUrl: 'https://identitytoolkit.googleapis.com/v1',
    secureTokenUrl: 'https://securetoken.googleapis.com/v1',
  },
};
