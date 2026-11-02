import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AppConfig } from './app-config.model';

export type { AppConfig } from './app-config.model';

/** Configuração do ambiente atual. Nos testes, sobrescreva com `{ provide: APP_CONFIG, useValue: ... }`. */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => environment,
});
