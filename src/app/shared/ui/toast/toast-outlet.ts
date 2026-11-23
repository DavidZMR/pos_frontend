import { Component, inject } from '@angular/core';
import { PosIcon } from '../icon/icon';
import type { IconName } from '../icon/icons';
import { type ToastTone, ToastService } from './toast-service';

const ICON: Record<ToastTone, IconName> = {
  success: 'circle-check',
  error: 'circle-x',
  warning: 'alert',
  info: 'info',
};

@Component({
  selector: 'pos-toast-outlet',
  imports: [PosIcon],
  template: `
    <div class="stack" aria-live="polite" aria-relevant="additions">
      @for (toast of service.toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast tone-' + toast.tone"
          [attr.role]="toast.tone === 'error' ? 'alert' : 'status'"
        >
          <pos-icon class="icon" [name]="icon[toast.tone]" [size]="20" />
          <p class="message">{{ toast.message }}</p>
          <button
            type="button"
            class="close"
            aria-label="Cerrar aviso"
            (click)="service.dismiss(toast.id)"
          >
            <pos-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    /* Arriba a la derecha: nunca tapa los botones de acción (Cobrar, Registrar) que van abajo. */
    .stack {
      position: fixed;
      inset-block-start: calc(var(--topbar-h) + var(--space-3));
      inset-inline-end: var(--space-6);
      z-index: 1100;
      display: grid;
      gap: var(--space-2);
      width: min(24rem, calc(100vw - 2rem));
    }
    .toast {
      --toast-mark: var(--info);
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      background: var(--surface-inverse);
      color: var(--ink-inverse);
      border-radius: var(--radius-lg);
      border-inline-start: 4px solid var(--toast-mark);
      box-shadow: var(--shadow-float);
      animation: toast-in var(--dur) var(--ease-out);
    }
    .tone-success {
      --toast-mark: var(--success);
    }
    .tone-error {
      --toast-mark: var(--danger);
    }
    .tone-warning {
      --toast-mark: var(--warning);
    }
    .icon {
      color: var(--toast-mark);
      margin-top: 1px;
    }
    .message {
      font-size: var(--text-sm);
      line-height: 1.45;
    }
    .close {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      border: 0;
      border-radius: var(--radius);
      background: transparent;
      color: var(--ink-inverse-muted);
      cursor: pointer;
      transition:
        background-color var(--dur-fast) var(--ease-out),
        color var(--dur-fast) var(--ease-out);
    }
    .close:hover {
      background: var(--surface-inverse-raised);
      color: var(--ink-inverse);
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
    }
  `,
})
export class PosToastOutlet {
  protected readonly service = inject(ToastService);
  protected readonly icon = ICON;
}
