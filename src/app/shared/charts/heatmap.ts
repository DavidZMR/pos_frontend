import { Component, computed, input } from '@angular/core';

export interface HeatCell {
  row: number;
  col: number;
  value: number;
  /** Texto completo para el tooltip y lectores de pantalla. */
  text: string;
}

const STEPS = [100, 200, 300, 400, 500, 600, 700] as const;

/**
 * Mapa de calor (horas pico): un solo tono, de claro a oscuro según la magnitud (escala
 * secuencial). Cada celda lleva su texto en `title` y `aria-label`.
 */
@Component({
  selector: 'pos-heatmap',
  template: `
    <div
      class="grid"
      role="table"
      [attr.aria-label]="ariaLabel()"
      [style.--cols]="cols().length"
      [class.loading]="loading()"
    >
      <div class="corner" role="presentation"></div>
      @for (col of cols(); track col.id) {
        <div class="col-head num" role="columnheader">{{ col.label }}</div>
      }
      @for (row of rows(); track row.id) {
        <div class="row-head" role="rowheader">{{ row.label }}</div>
        @for (col of cols(); track col.id) {
          @let cell = cellAt(row.id, col.id);
          <div
            class="cell"
            role="cell"
            [style.background]="colorOf(cell?.value ?? 0)"
            [attr.title]="cell?.text ?? null"
            [attr.aria-label]="cell?.text ?? row.label + ' ' + col.label + ': sin ventas'"
          ></div>
        }
      }
    </div>
    <div class="scale" aria-hidden="true">
      <span>Menos</span>
      @for (step of steps; track step) {
        <span class="swatch" [style.background]="'var(--seq-' + step + ')'"></span>
      }
      <span>Más</span>
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: 2.75rem repeat(var(--cols), minmax(1.25rem, 1fr));
      gap: 2px;
      font-size: var(--text-xs);
      transition: opacity var(--dur) var(--ease-out);
    }
    .grid.loading {
      opacity: 0.45;
    }
    .col-head {
      text-align: center;
      color: var(--ink-muted);
    }
    .row-head {
      color: var(--ink-muted);
      align-self: center;
    }
    .cell {
      height: 1.6rem;
      border-radius: 3px;
    }
    .scale {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 3px;
      margin-top: var(--space-3);
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
    .swatch {
      width: 1rem;
      height: 0.75rem;
      border-radius: 2px;
    }
    @media (max-width: 640px) {
      .grid {
        overflow-x: auto;
      }
    }
  `,
})
export class PosHeatmap {
  readonly rows = input.required<{ id: number; label: string }[]>();
  readonly cols = input.required<{ id: number; label: string }[]>();
  readonly cells = input.required<HeatCell[]>();
  readonly ariaLabel = input('');
  readonly loading = input(false);

  protected readonly steps = STEPS;
  private readonly index = computed(
    () => new Map(this.cells().map((c) => [`${c.row}:${c.col}`, c])),
  );
  private readonly max = computed(() => Math.max(0, ...this.cells().map((c) => c.value)));

  protected cellAt(row: number, col: number): HeatCell | undefined {
    return this.index().get(`${row}:${col}`);
  }

  /** 0 = superficie; el resto en 7 escalones del azul secuencial. */
  protected colorOf(value: number): string {
    const max = this.max();
    if (!value || !max) return 'var(--surface-sunken)';
    const step = STEPS[Math.min(STEPS.length - 1, Math.floor((value / max) * STEPS.length))];
    return `var(--seq-${step})`;
  }
}
