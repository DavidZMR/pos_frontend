import { Component, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

/** Etiqueta de estado: <pos-badge tone="success">Activo</pos-badge> */
@Component({
  selector: 'pos-badge',
  template: `<span class="dot" aria-hidden="true"></span><ng-content />`,
  host: { '[class]': '"tone-" + tone()' },
  styles: `
    :host {
      --badge-ink: var(--ink-muted);
      --badge-bg: var(--surface-sunken);
      --badge-dot: var(--ink-faint);
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      height: 1.5rem;
      padding-inline: var(--space-2) 0.625rem;
      border-radius: 999px;
      background: var(--badge-bg);
      color: var(--badge-ink);
      font-size: var(--text-xs);
      font-weight: 600;
      white-space: nowrap;
    }
    .dot {
      width: 0.4375rem;
      height: 0.4375rem;
      border-radius: 50%;
      background: var(--badge-dot);
    }
    :host(.tone-brand) {
      --badge-ink: var(--brand-ink);
      --badge-bg: var(--brand-soft);
      --badge-dot: var(--brand);
    }
    :host(.tone-success) {
      --badge-ink: var(--success);
      --badge-bg: var(--success-soft);
      --badge-dot: var(--success);
    }
    :host(.tone-warning) {
      --badge-ink: var(--warning-ink);
      --badge-bg: var(--warning-soft);
      --badge-dot: var(--warning);
    }
    :host(.tone-danger) {
      --badge-ink: var(--danger-hover);
      --badge-bg: var(--danger-soft);
      --badge-dot: var(--danger);
    }
  `,
})
export class PosBadge {
  readonly tone = input<BadgeTone>('neutral');
}
