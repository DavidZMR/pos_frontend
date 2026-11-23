import { Component, input } from '@angular/core';
import { PosIcon } from '../icon/icon';
import type { IconName } from '../icon/icons';

export type StatTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

/**
 * Indicador (KPI): etiqueta, valor grande en Archivo y detalle.
 *   <pos-stat-tile label="Valor del inventario" [value]="total | money" icon="warehouse" />
 */
@Component({
  selector: 'pos-stat-tile',
  imports: [PosIcon],
  template: `
    <div class="head">
      <span class="label">{{ label() }}</span>
      @if (icon(); as name) {
        <span class="icon"><pos-icon [name]="name" [size]="18" /></span>
      }
    </div>
    <p class="value num">{{ value() }}</p>
    @if (detail()) {
      <p class="detail">{{ detail() }}</p>
    }
  `,
  host: { '[class]': '"tone-" + tone()' },
  styles: `
    :host {
      --stat-mark: var(--brand);
      display: grid;
      gap: var(--space-1);
      padding: var(--space-4) var(--space-5);
      background: var(--surface-raised);
      border: var(--border);
      border-radius: var(--radius-lg);
      border-top: 3px solid var(--stat-mark);
    }
    :host(.tone-neutral) {
      --stat-mark: var(--line-strong);
    }
    :host(.tone-success) {
      --stat-mark: var(--success);
    }
    :host(.tone-warning) {
      --stat-mark: var(--warning);
    }
    :host(.tone-danger) {
      --stat-mark: var(--danger);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .label {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    .icon {
      color: var(--stat-mark);
    }
    .value {
      font-family: var(--font-display);
      font-stretch: var(--display-stretch);
      font-size: var(--text-2xl);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.01em;
    }
    .detail {
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
  `,
})
export class PosStatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly detail = input('');
  readonly icon = input<IconName>();
  readonly tone = input<StatTone>('brand');
}
