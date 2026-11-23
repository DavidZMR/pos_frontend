import { Component, input } from '@angular/core';

/**
 * Encabezado de pantalla: título (Archivo semicondensada), descripción y acciones a la derecha.
 *   <pos-page-header heading="Usuarios" description="…">
 *     <button posButton headerActions>…</button>
 *   </pos-page-header>
 */
@Component({
  selector: 'pos-page-header',
  template: `
    <div class="text">
      @if (eyebrow()) {
        <p class="eyebrow">{{ eyebrow() }}</p>
      }
      <h1 class="title">{{ heading() }}</h1>
      @if (description()) {
        <p class="description">{{ description() }}</p>
      }
    </div>
    <div class="actions"><ng-content select="[headerActions]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4) var(--space-6);
      padding-bottom: var(--space-5);
      margin-bottom: var(--space-6);
      border-bottom: var(--border);
    }
    .text {
      display: grid;
      gap: var(--space-2);
      min-width: 0;
    }
    .eyebrow {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--brand-ink);
    }
    .title {
      font-size: var(--text-3xl);
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .description {
      max-width: var(--measure);
      color: var(--ink-muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  `,
})
export class PosPageHeader {
  readonly heading = input.required<string>();
  readonly description = input('');
  readonly eyebrow = input('');
}
