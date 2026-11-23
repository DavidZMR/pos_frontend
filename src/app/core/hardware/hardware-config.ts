import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import type { HardwareConfig } from '../config/pos-bridge';

/** Configuración de hardware de esta PC (solo app de escritorio; null en el navegador). */
@Service()
export class HardwareConfigService {
  private readonly bridge = inject(DOCUMENT).defaultView?.pos?.hardware;

  readonly supported = Boolean(this.bridge);

  load(): Promise<HardwareConfig | null> {
    return this.bridge?.getConfig() ?? Promise.resolve(null);
  }
}
