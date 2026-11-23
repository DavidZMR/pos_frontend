import { Component, computed, inject } from '@angular/core';
import { PrinterStore } from '../core/hardware/printer-store';
import { ScaleStore } from '../core/hardware/scale-store';
import { PosIcon } from '../shared/ui';

const LABEL = {
  connecting: 'conectando',
  waiting: 'sin datos',
  connected: 'conectada',
  error: 'desconectada',
} as const;

/** Báscula e impresora en la barra superior (cada una solo si esta PC la tiene configurada). */
@Component({
  selector: 'pos-device-status',
  host: { class: 'devices' },
  imports: [PosIcon],
  template: `
    @if (view(); as v) {
      <span class="indicator scale" [class]="v.state" [attr.title]="v.message" role="status">
        <pos-icon name="scale" [size]="16" />
        <span class="dot" aria-hidden="true"></span>
        <span class="text">Báscula {{ v.label }}</span>
      </span>
    }
    @if (printer(); as p) {
      <span class="indicator printer" [class]="p.state" [attr.title]="p.message" role="status">
        <pos-icon name="printer" [size]="16" />
        <span class="dot" aria-hidden="true"></span>
        <span class="text">{{ p.label }}</span>
      </span>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: var(--space-2);
    }
    .indicator {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      height: 2rem;
      padding: 0 var(--space-3);
      border: 1px solid var(--line);
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--ink-muted);
    }
    .dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--warning);
    }
    .connected .dot {
      background: var(--success);
    }
    .error {
      border-color: var(--danger);
      color: var(--danger-hover);
    }
    .error .dot {
      background: var(--danger);
    }
    @media (max-width: 640px) {
      .text {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
    }
  `,
})
export class PosDeviceStatus {
  private readonly scale = inject(ScaleStore);
  private readonly printers = inject(PrinterStore);

  protected readonly printer = computed(() => {
    const name = this.printers.config().name;
    if (!name || !this.printers.loaded()) return null;
    return this.printers.ready()
      ? { state: 'connected', label: 'Impresora lista', message: name }
      : {
          state: 'error',
          label: 'Impresora no encontrada',
          message: `"${name}" no aparece en Windows`,
        };
  });

  protected readonly view = computed(() => {
    const { state, message } = this.scale.status();
    if (state === 'disabled') return null;
    return { state, message, label: LABEL[state] };
  });
}
