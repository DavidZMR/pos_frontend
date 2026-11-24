import { Component, computed, input } from '@angular/core';
import type { ChartSlot } from './chart-config';

export interface Segment {
  id: string;
  label: string;
  value: number;
  valueText: string;
  /** El color sigue a la entidad (no a su lugar): efectivo siempre es la ranura 1. */
  slot: ChartSlot;
}

/**
 * Un total partido en ≤ 4 partes (formas de pago): barra alta con la participación dentro de
 * cada bloque cuando cabe, y leyenda con nombre, monto y porcentaje debajo.
 */
@Component({
  selector: 'pos-segmented-bar',
  template: `
    @if (total() > 0) {
      <div class="bar" role="img" [attr.aria-label]="ariaText()" [class.loading]="loading()">
        @for (part of parts(); track part.id) {
          @if (part.value > 0) {
            <span
              class="block"
              [style.flex-grow]="part.value"
              [style.background]="'var(--chart-' + part.slot + ')'"
              [class.dark-ink]="part.slot === 4"
              [attr.title]="part.label + ': ' + part.valueText + ' (' + part.shareText + ')'"
            >
              @if (part.share >= 0.1) {
                <span class="share">{{ part.shareText }}</span>
              }
            </span>
          }
        }
      </div>
      <ul class="legend">
        @for (part of parts(); track part.id) {
          <li>
            <span class="key" [style.background]="'var(--chart-' + part.slot + ')'"></span>
            <span class="name">{{ part.label }}</span>
            <span class="amount num">{{ part.valueText }}</span>
            <span class="pct num">{{ part.shareText }}</span>
          </li>
        }
      </ul>
    } @else {
      <p class="empty">Sin ventas en este periodo.</p>
    }
  `,
  styles: `
    .bar {
      display: flex;
      gap: 2px;
      height: 28px;
      transition: opacity var(--dur) var(--ease-out);
    }
    .bar.loading {
      opacity: 0.45;
    }
    .block {
      display: flex;
      align-items: center;
      min-width: 2px;
      padding: 0 var(--space-2);
      border-radius: 4px;
      color: #fff;
      overflow: hidden;
    }
    .block.dark-ink {
      color: #0b0b0b;
    }
    .share {
      font-size: var(--text-xs);
      font-weight: 700;
      white-space: nowrap;
    }
    .legend {
      display: grid;
      gap: var(--space-1);
      margin: var(--space-4) 0 0;
      padding: 0;
      list-style: none;
      font-size: var(--text-sm);
    }
    .legend li {
      display: grid;
      grid-template-columns: auto 1fr auto 4rem;
      align-items: center;
      gap: var(--space-3);
    }
    .key {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 2px;
    }
    .amount {
      font-weight: 600;
    }
    .pct {
      color: var(--ink-muted);
      text-align: right;
    }
    .empty {
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
  `,
})
export class PosSegmentedBar {
  readonly segments = input.required<Segment[]>();
  readonly ariaLabel = input('');
  readonly loading = input(false);

  protected readonly total = computed(() => this.segments().reduce((s, p) => s + p.value, 0));
  protected readonly parts = computed(() => {
    const total = this.total();
    return this.segments().map((p) => {
      const share = total ? p.value / total : 0;
      return { ...p, share, shareText: `${(share * 100).toFixed(1)} %` };
    });
  });
  protected readonly ariaText = computed(
    () =>
      `${this.ariaLabel()}: ${this.parts()
        .map((p) => `${p.label} ${p.valueText} (${p.shareText})`)
        .join(', ')}`,
  );
}
