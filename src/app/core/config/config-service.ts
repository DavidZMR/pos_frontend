import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import type { PosBridge } from './pos-bridge';

/** Backend local de desarrollo (`npm run dev` en pos_backend). */
export const DEFAULT_API_URL = 'http://127.0.0.1:3000/api';

/**
 * Único origen de configuración de la app. En Electron lee `window.pos.config`
 * (el puerto del backend embebido es dinámico); en navegador usa DEFAULT_API_URL.
 */
@Service()
export class ConfigService {
  private readonly bridge: PosBridge | undefined = inject(DOCUMENT).defaultView?.pos;

  readonly apiUrl = (this.bridge?.config?.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
  readonly appVersion = this.bridge?.config?.appVersion ?? 'dev';
  readonly isDesktop = Boolean(this.bridge);

  /** URL absoluta del API v1: `api('/users')` → http://…/api/v1/users */
  api(path: string): string {
    return `${this.apiUrl}/v1${path.startsWith('/') ? path : `/${path}`}`;
  }

  isApiRequest(url: string): boolean {
    return url.startsWith(this.apiUrl);
  }
}
