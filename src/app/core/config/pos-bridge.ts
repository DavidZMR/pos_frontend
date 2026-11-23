/**
 * Puente que expone el preload de Electron en `window.pos` (contextBridge).
 * En el navegador (ng serve) no existe y la app usa valores por defecto.
 */
export interface PosBridgeConfig {
  /** URL base del API, p. ej. http://127.0.0.1:53124/api */
  apiUrl: string;
  appVersion?: string;
}

export interface PosBridge {
  config?: PosBridgeConfig;
}

declare global {
  interface Window {
    pos?: PosBridge;
  }
}
