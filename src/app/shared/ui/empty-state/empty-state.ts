import { Component, input } from '@angular/core';
import { PosIcon } from '../icon/icon';
import type { IconName } from '../icon/icons';

/** Mensaje para listas vacías o sin resultados, con acción opcional proyectada. */
@Component({
  selector: 'pos-empty-state',
  imports: [PosIcon],
  template: `
    <div class="mark"><pos-icon [name]="icon()" [size]="28" /></div>
    <p class="title">{{ heading() }}</p>
    @if (message()) {
      <p class="message">{{ message() }}</p>
    }
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
      text-align: center;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 3.5rem;
      height: 3.5rem;
      margin-bottom: var(--space-2);
      border: 1px dashed var(--line-strong);
      border-radius: 50%;
      color: var(--ink-faint);
    }
    .title {
      font-family: var(--font-display);
      font-stretch: var(--display-stretch);
      font-size: var(--text-lg);
      font-weight: 650;
      color: var(--ink);
    }
    .message {
      max-width: 42ch;
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
    .actions:not(:empty) {
      margin-top: var(--space-3);
    }
  `,
})
export class PosEmptyState {
  readonly icon = input<IconName>('inbox');
  readonly heading = input.required<string>();
  readonly message = input('');
}
