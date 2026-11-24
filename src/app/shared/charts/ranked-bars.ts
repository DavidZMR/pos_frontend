import { Component, computed, input } from '@angular/core';

export interface RankedBar {
  id: string;
  label: string;
  /** Texto secundario bajo el nombre (código, cantidad…). */
  sublabel?: string;
  value: number;
  /** Valor impreso en la punta de la barra. */
  valueText: string;
  /** Dato extra a la derecha (participación, margen…). */
  detail?: string;
}

/**
 * Barras horizontales ordenadas (lo más vendido, categorías, cajeros): un solo color, la barra
 * más grande al 100 % y el valor escrito en la punta. Es su propia tabla: todo valor es legible
 * sin pasar el cursor.
 */
@Component({
  selector: 'pos-ranked-bars',
  template: `
    @if (items().length) {
      <ol class="list" [class.loading]="loading()" [attr.aria-label]="ariaLabel()">
        @for (item of items(); track item.id; let i = $index) {
          <li class="row">
            @if (showRank()) {
              <span class="rank num" aria-hidden="true">{{ i + 1 }}</span>
            }
            <span class="text">
              <span class="label">{{ item.label }}</span>
              @if (item.sublabel) {
                <span class="sublabel">{{ item.sublabel }}</span>
              }
            </span>
            <span class="track" aria-hidden="true">
              <span class="bar" [style.width.%]="widthOf(item.value)"></span>
            </span>
            <span class="value num">{{ item.valueText }}</span>
            @if (item.detail) {
              <span class="detail num">{{ item.detail }}</span>
            }
          </li>
        }
      </ol>
    } @else {
      <p class="empty">{{ emptyText() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    .list {
      display: grid;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
      transition: opacity var(--dur) var(--ease-out);
    }
    .list.loading {
      opacity: 0.45;
    }
    .row {
      display: grid;
      grid-template-columns: auto minmax(8rem, 2fr) minmax(4rem, 3fr) auto auto;
      align-items: center;
      gap: var(--space-3);
      min-height: 2.25rem;
      padding: var(--space-1) 0;
      border-bottom: 1px solid var(--line);
    }
    .row:last-child {
      border-bottom: none;
    }
    .rank {
      width: 1.5rem;
      font-size: var(--text-xs);
      color: var(--ink-faint);
      text-align: right;
    }
    .text {
      display: grid;
      min-width: 0;
    }
    /* Nombres largos en dos renglones como máximo (mejor que cortarlos con "…"). */
    .label {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      font-weight: 600;
      font-size: var(--text-sm);
    }
    .sublabel {
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
    .track {
      display: block;
      height: 0.875rem;
    }
    .bar {
      display: block;
      height: 100%;
      min-width: 2px;
      border-radius: 0 4px 4px 0;
      background: var(--chart-1);
    }
    .value {
      font-weight: 600;
      font-size: var(--text-sm);
      text-align: right;
      white-space: nowrap;
    }
    .detail {
      min-width: 3.5rem;
      font-size: var(--text-xs);
      color: var(--ink-muted);
      text-align: right;
      white-space: nowrap;
    }
    .empty {
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
    /* Según el ancho de la TARJETA (no de la pantalla): en tarjetas angostas, sin columna extra
       y la barra bajo el nombre. */
    @container (max-width: 36rem) {
      .detail {
        display: none;
      }
    }
    @container (max-width: 26rem) {
      .row {
        grid-template-columns: auto minmax(0, 1fr) auto;
      }
      .track {
        grid-column: 2 / -1;
        grid-row: 2;
      }
    }
  `,
})
export class PosRankedBars {
  readonly items = input.required<RankedBar[]>();
  readonly ariaLabel = input('');
  readonly showRank = input(true);
  readonly loading = input(false);
  readonly emptyText = input('Sin datos en este periodo.');

  private readonly max = computed(() => Math.max(0, ...this.items().map((i) => i.value)));

  protected widthOf(value: number): number {
    const max = this.max();
    return max > 0 ? Math.max(0, (value / max) * 100) : 0;
  }
}
