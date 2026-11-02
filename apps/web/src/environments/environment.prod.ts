import { AppConfig } from '../app/core/config/app-config.model';

/**
 * Produção (Checkpoint 3 — Plano Custo Zero, ADR-011): frontend no Firebase Hosting chamando
 * a API publicada no Render. Preencher `apiBaseUrl` com a URL do serviço do Render e
 * `apiKey` com a chave Web do projeto Firebase antes do primeiro deploy.
 */
export const environment: AppConfig = {
  apiBaseUrl: '/api',
  auth: {
    apiKey: '',
    identityToolkitUrl: 'https://identitytoolkit.googleapis.com/v1',
    secureTokenUrl: 'https://securetoken.googleapis.com/v1',
  },
};
