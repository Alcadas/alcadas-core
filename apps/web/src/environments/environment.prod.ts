import { AppConfig } from '../app/core/config/app-config.model';

/**
 * Produção (Checkpoint 3 — Plano Custo Zero, ADR-011): frontend no Firebase Hosting chamando
 * a API publicada no Render.
 * A apiKey é resolvida dinamicamente em runtime através de /__/firebase/init.json
 * fornecido nativamente pelo Firebase Hosting, sem expor chaves no repositório Git.
 */
export const environment: AppConfig = {
  production: true,
  apiBaseUrl: 'https://alcadas-core.onrender.com/api',
  auth: {
    apiKey: '',
    identityToolkitUrl: 'https://identitytoolkit.googleapis.com/v1',
    secureTokenUrl: 'https://securetoken.googleapis.com/v1',
  },
};
