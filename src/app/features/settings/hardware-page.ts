import { Component, inject, resource } from '@angular/core';
import { HardwareConfigService } from '../../core/hardware/hardware-config';
import { PosCard, PosEmptyState, PosPageHeader, PosSpinner } from '../../shared/ui';
import { PosScaleSettings } from './scale-settings';

/** Equipo de ESTA computadora (báscula; impresora en la siguiente entrega). */
@Component({
  selector: 'pos-hardware-page',
  imports: [PosCard, PosEmptyState, PosPageHeader, PosSpinner, PosScaleSettings],
  template: `
    <pos-page-header
      eyebrow="Administración"
      heading="Equipo de esta PC"
      description="Báscula de esta computadora. Cada caja se configura por separado y todo es opcional."
    />

    @if (!hardware.supported) {
      <pos-card>
        <pos-empty-state
          icon="settings"
          heading="Solo en la app de escritorio"
          message="La báscula se configura desde PuntoVenta instalado en la computadora de la caja. En el navegador el peso se escribe a mano."
        />
      </pos-card>
    } @else if (config.isLoading()) {
      <div class="center"><pos-spinner [size]="28" label="Cargando configuración" /></div>
    } @else if (config.value(); as current) {
      <div class="sections">
        <pos-scale-settings [config]="current.scale" />
      </div>
    }
  `,
  styles: `
    .center {
      display: grid;
      place-items: center;
      min-height: 12rem;
    }
    .sections {
      display: grid;
      gap: var(--space-6);
    }
  `,
})
export class HardwarePage {
  protected readonly hardware = inject(HardwareConfigService);
  protected readonly config = resource({ loader: () => this.hardware.load() });
}
