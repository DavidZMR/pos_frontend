import { Component, input } from '@angular/core';

/** Indicador de carga. Con `label` se anuncia a lectores de pantalla; sin él es decorativo. */
@Component({
  selector: 'pos-spinner',
  template: `
    <span class="ring" aria-hidden="true"></span>
    @if (label()) {
      <span class="visually-hidden">{{ label() }}</span>
    }
  `,
  host: {
    '[attr.role]': "label() ? 'status' : null",
    '[style.--spinner-size.px]': 'size()',
  },
  styles: `
    :host {
      display: inline-flex;
      width: var(--spinner-size);
      height: var(--spinner-size);
      flex: none;
    }
    .ring {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-right-color: transparent;
      animation: spin 720ms linear infinite;
      opacity: 0.85;
    }
    @keyframes spin {
      to {
        transform: rotate(1turn);
      }
    }
  `,
})
export class PosSpinner {
  readonly size = input(18);
  readonly label = input('');
}
