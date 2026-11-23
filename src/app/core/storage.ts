import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';

/** localStorage tolerante a fallos (modo privado, cuotas). Valores en JSON. */
@Service()
export class LocalStore {
  private readonly storage: Storage | null = (() => {
    try {
      return inject(DOCUMENT).defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  })();

  get<T>(key: string): T | null {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): void {
    try {
      this.storage?.setItem(key, JSON.stringify(value));
    } catch {
      /* sin almacenamiento: la sesión vive solo en memoria */
    }
  }

  remove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      /* ignorar */
    }
  }
}
