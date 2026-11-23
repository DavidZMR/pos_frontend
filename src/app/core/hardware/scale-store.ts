import { DOCUMENT } from '@angular/common';
import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import type {
  DetectResult,
  ScaleConfig,
  ScaleReading,
  ScaleStatus,
  SerialPortOption,
} from '../config/pos-bridge';

const NO_SCALE: ScaleStatus = { state: 'disabled', message: 'Sin báscula configurada', path: '' };

/**
 * Báscula de esta PC (app de escritorio). Sin báscula —o en el navegador— el estado es
 * `disabled` y el cajero escribe el peso.
 */
@Service()
export class ScaleStore {
  private readonly bridge = inject(DOCUMENT).defaultView?.pos?.scale;

  /** La app corre en escritorio con acceso a puertos seriales. */
  readonly supported = Boolean(this.bridge);
  readonly status = signal<ScaleStatus>(NO_SCALE);
  /** Último peso leído (gramos enteros), o null si no hay lectura vigente. */
  readonly reading = signal<ScaleReading | null>(null);

  readonly enabled = computed(() => this.status().state !== 'disabled');
  readonly connected = computed(() => this.status().state === 'connected');

  constructor() {
    if (!this.bridge) return;
    let gotEvent = false;
    const offStatus = this.bridge.onStatus((status) => {
      gotEvent = true;
      this.status.set(status);
      if (status.state !== 'connected') this.reading.set(null);
    });
    const offReading = this.bridge.onReading((reading) => {
      gotEvent = true;
      this.reading.set(reading);
    });
    inject(DestroyRef).onDestroy(() => {
      offStatus();
      offReading();
    });
    void this.bridge.getState().then(({ status, reading }) => {
      if (gotEvent) return; // un evento llegó antes: es más reciente que esta foto
      this.status.set(status);
      this.reading.set(reading);
    });
  }

  listPorts(): Promise<SerialPortOption[]> {
    return this.bridge?.listPorts() ?? Promise.resolve([]);
  }

  /** Busca la báscula en los puertos COM; `onProgress` recibe mensajes para mostrar. */
  async detect(onProgress: (message: string) => void): Promise<DetectResult> {
    if (!this.bridge) return { scale: null, message: 'Solo en la app de escritorio' };
    const off = this.bridge.onDetectProgress(onProgress);
    try {
      return await this.bridge.detect();
    } finally {
      off();
    }
  }

  async saveConfig(config: ScaleConfig): Promise<ScaleConfig> {
    if (!this.bridge) throw new Error('La báscula solo se configura en la app de escritorio');
    return this.bridge.saveConfig(config);
  }
}
