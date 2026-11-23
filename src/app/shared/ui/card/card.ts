import { Component, input } from '@angular/core';

/** Superficie elevada con borde fino. Título opcional (`heading`) y acciones con [cardActions]. */
@Component({
  selector: 'pos-card',
  template: `
    @if (heading()) {
      <header class="head">
        <h2 class="title">{{ heading() }}</h2>
        <ng-content select="[cardActions]" />
      </header>
    }
    <div class="body" [class.flush]="flush()"><ng-content /></div>
  `,
  styles: `
    :host {
      display: block;
      background: var(--surface-raised);
      border: var(--border);
      border-radius: var(--radius-lg);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-bottom: var(--border);
    }
    .title {
      font-size: var(--text-lg);
    }
    .body {
      padding: var(--space-5);
    }
    .body.flush {
      padding: 0;
    }
  `,
})
export class PosCard {
  readonly heading = input('');
  readonly flush = input(false);
}
