import { Component, computed, input, output } from '@angular/core';
import { PosButton } from '../button/button';

const numberFormatter = new Intl.NumberFormat('es-MX');

/** Paginación: "21–40 de 132" + anterior/siguiente. */
@Component({
  selector: 'pos-paginator',
  imports: [PosButton],
  template: `
    <nav class="paginator" aria-label="Paginación">
      <p class="range" aria-live="polite">
        <span class="num">{{ range() }}</span> de <span class="num">{{ totalText() }}</span>
      </p>
      <div class="controls">
        <button
          posButton
          variant="secondary"
          size="sm"
          icon="chevron-left"
          iconOnly
          aria-label="Página anterior"
          [disabled]="disabled() || page() <= 1"
          (click)="pageChange.emit(page() - 1)"
        ></button>
        <span class="page num">{{ page() }} / {{ pages() }}</span>
        <button
          posButton
          variant="secondary"
          size="sm"
          icon="chevron-right"
          iconOnly
          aria-label="Página siguiente"
          [disabled]="disabled() || page() >= pages()"
          (click)="pageChange.emit(page() + 1)"
        ></button>
      </div>
    </nav>
  `,
  styles: `
    .paginator {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: var(--surface-raised);
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
    .controls {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .page {
      min-width: 4.5rem;
      text-align: center;
      color: var(--ink);
      font-weight: 600;
    }
  `,
})
export class PosPaginator {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly total = input.required<number>();
  readonly limit = input.required<number>();
  readonly disabled = input(false);
  readonly pageChange = output<number>();

  protected readonly range = computed(() => {
    const start = (this.page() - 1) * this.limit() + 1;
    const end = Math.min(this.page() * this.limit(), this.total());
    return `${numberFormatter.format(start)}–${numberFormatter.format(end)}`;
  });
  protected readonly totalText = computed(() => numberFormatter.format(this.total()));
}
