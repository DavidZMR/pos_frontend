import { Component, inject, resource } from '@angular/core';
import { HardwareConfigService } from '../../core/hardware/hardware-config';
import {
  PosBusinessGate,
  PosCard,
  PosEmptyState,
  PosPageHeader,
  PosSpinner,
} from '../../shared/ui';
import { PosPrinterSettings } from './printer-settings';
import { PosScaleSettings } from './scale-settings';
import { PosTicketSettings } from './ticket-settings';

/** Equipo de ESTA computadora (báscula, impresora) y datos del ticket del negocio. */
@Component({
  selector: 'pos-hardware-page',
  imports: [
    PosBusinessGate,
    PosCard,
    PosEmptyState,
    PosPageHeader,
    PosSpinner,
    PosPrinterSettings,
    PosScaleSettings,
    PosTicketSettings,
  ],
  template: `
    <pos-page-header
      eyebrow="Administración"
      heading="Equipo de esta PC"
      description="Báscula e impresora de esta computadora (cada caja se configura por separado; todo es opcional) y los datos que salen en el ticket."
    />

    <div class="sections">
      @if (!hardware.supported) {
        <pos-card>
          <pos-empty-state
            icon="settings"
            heading="Báscula e impresora: solo en la app de escritorio"
            message="Se configuran desde PuntoVenta instalado en la computadora de la caja. En el navegador el peso se escribe a mano y no se imprimen tickets."
          />
        </pos-card>
      } @else if (config.isLoading()) {
        <div class="center"><pos-spinner [size]="28" label="Cargando configuración" /></div>
      } @else if (config.value(); as current) {
        <pos-scale-settings [config]="current.scale" />
        <pos-printer-settings />
      }

      <pos-business-gate>
        <pos-ticket-settings />
      </pos-business-gate>
    </div>
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
