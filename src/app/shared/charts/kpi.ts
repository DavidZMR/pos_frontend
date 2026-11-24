import { Component, computed, input } from '@angular/core';
import { PosIcon } from '../ui';
import { formatBp } from './chart-format';

/**
 * Cifra principal con su cambio contra el periodo anterior. El cambio lleva flecha y signo
 * (nunca solo color) y el color depende de si subir es bueno.
 *   <pos-kpi label="Ventas" [value]="text" [deltaBp]="1234" previousLabel="vs. 30 días previos" />
 */
@Component({
  selector: 'pos-kpi',
  imports: [PosIcon],
  template: `
    <p class="label">{{ label() }}</p>
    <p class="value" [class.hero]="hero()">{{ value() }}</p>
    @if (deltaBp() !== null) {
      <p class="delta" [class]="tone()">
        <pos-icon
          [name]="
            direction() === 'up' ? 'arrow-up' : direction() === 'down' ? 'arrow-down' : 'minus'
          "
          [size]="14"
        />
        <span class="num">{{ deltaText() }}</span>
        <span class="vs">{{ previousLabel() }}</span>
      </p>
    } @else if (hint()) {
      <p class="delta flat">
        <span class="vs">{{ hint() }}</span>
      </p>
    }
  `,
  styles: `
    /* La cifra se ajusta al ancho de su tarjeta: "$6,742,033.44" nunca se sale. */
    :host {
      container-type: inline-size;
      display: grid;
      align-content: start;
      gap: var(--space-1);
      padding: var(--space-4) var(--space-5);
      background: var(--surface-raised);
      border: var(--border);
      border-radius: var(--radius-lg);
    }
    .label {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    .value {
      font-size: min(var(--text-2xl), 12.5cqi);
      overflow-wrap: anywhere;
      font-weight: 700;
      line-height: 1.15;
    }
    .value.hero {
      font-size: min(3.5rem, 12.5cqi);
      letter-spacing: -0.02em;
    }
    .delta {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      font-weight: 600;
    }
    .delta.good {
      color: var(--success);
    }
    .delta.bad {
      color: var(--danger-hover);
    }
    .delta.flat {
      color: var(--ink-muted);
    }
    .vs {
      font-weight: 400;
      color: var(--ink-muted);
    }
  `,
})
export class PosKpi {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  /** Cambio vs. el periodo anterior en puntos base; null = sin comparación. */
  readonly deltaBp = input<number | null>(null);
  readonly previousLabel = input('vs. periodo anterior');
  /** Para cancelaciones o costos, subir es malo. */
  readonly upIsGood = input(true);
  readonly hero = input(false);
  readonly hint = input('');

  protected readonly direction = computed(() => {
    const delta = this.deltaBp() ?? 0;
    return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  });
  protected readonly tone = computed(() => {
    const direction = this.direction();
    if (direction === 'flat') return 'flat';
    return (direction === 'up') === this.upIsGood() ? 'good' : 'bad';
  });
  protected readonly deltaText = computed(() => {
    const delta = this.deltaBp() ?? 0;
    return `${delta > 0 ? '+' : ''}${formatBp(delta)}`;
  });
}
