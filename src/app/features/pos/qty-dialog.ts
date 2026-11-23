import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form, min, submit } from '@angular/forms/signals';
import { ScaleStore } from '../../core/hardware/scale-store';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { PosButton, PosDialog, PosIcon, PosQtyInput } from '../../shared/ui';
import { lineTotalCents } from '../../shared/utils/money';
import { UNITS, unitScale } from '../../shared/utils/qty';
import type { PosProduct } from './pos-models';

export interface QtyDialogData {
  product: PosProduct;
  /** Cantidad inicial (al editar un renglón). */
  qtyBase?: number;
}

export interface QtyDialogResult {
  qtyBase: number;
  /** El peso lo leyó la báscula (no se escribió a mano). */
  weighed: boolean;
}

/**
 * Captura de cantidad o peso. Para productos por kg con báscula conectada, el peso se lee solo
 * (el cajero confirma con Enter cuando está estable o escribe encima para corregirlo). Sin
 * báscula, el cajero escribe el peso.
 */
@Component({
  selector: 'pos-qty-dialog',
  imports: [FormField, PosDialog, PosQtyInput, PosButton, PosIcon, MoneyPipe],
  template: `
    <form novalidate (submit)="confirm(); $event.preventDefault()">
      <pos-dialog
        [heading]="data.product.name"
        [description]="(data.product.salePriceCents | money) + ' por ' + unitLabel"
      >
        <div class="body">
          <div (input)="typedByHand()">
            <pos-qty-input
              #qty
              [label]="isWeight ? 'Peso' : 'Cantidad'"
              [unit]="data.product.unit"
              [formField]="qtyForm.qtyBase"
            />
          </div>

          @if (usesScale) {
            @switch (scaleView()) {
              @case ('stable') {
                <p class="scale ok" role="status">
                  <pos-icon name="scale" [size]="16" />
                  Peso estable · Enter para agregar
                </p>
              }
              @case ('moving') {
                <p class="scale moving" role="status">
                  <span class="pulse" aria-hidden="true"></span>
                  Pesando… espera a que se estabilice
                </p>
              }
              @case ('empty') {
                <p class="scale" role="status">
                  <pos-icon name="scale" [size]="16" />
                  Coloca el producto en la báscula
                </p>
              }
              @case ('manual') {
                <p class="scale">
                  <pos-icon name="pencil" [size]="16" />
                  Peso escrito a mano
                  <button posButton variant="ghost" size="sm" icon="scale" (click)="useScale()">
                    Usar báscula
                  </button>
                </p>
              }
              @case ('offline') {
                <p class="scale warn" role="status">
                  <pos-icon name="alert" [size]="16" />
                  {{ scale.status().message }}. Escribe el peso.
                </p>
              }
            }
          } @else if (isWeight) {
            <p class="scale">
              <pos-icon name="pencil" [size]="16" />
              Escribe el peso en {{ unitLabel }}, p. ej. {{ example }}
            </p>
          }

          <div class="total">
            <span>Importe</span>
            <strong class="num">{{ total() | money }}</strong>
          </div>
        </div>
        <ng-container dialogActions>
          <button posButton variant="secondary" type="button" (click)="ref.close()">
            Cancelar
          </button>
          <button posButton type="submit" icon="check" [disabled]="waitingStable()">
            {{ data.qtyBase ? 'Cambiar' : 'Agregar' }}
          </button>
        </ng-container>
      </pos-dialog>
    </form>
  `,
  styles: `
    form {
      display: contents;
    }
    .body {
      display: grid;
      gap: var(--space-4);
    }
    .scale {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      min-height: 2rem;
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
    .scale.ok {
      color: var(--success);
      font-weight: 600;
    }
    .scale.moving {
      color: var(--warning-ink);
      font-weight: 600;
    }
    .scale.warn {
      color: var(--warning-ink);
    }
    .pulse {
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 50%;
      background: var(--warning);
      animation: pulse 0.9s cubic-bezier(0.65, 0, 0.35, 1) infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.3;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse {
        animation: none;
      }
    }
    .total {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius);
      background: var(--surface-sunken);
      color: var(--ink-muted);
      strong {
        font-family: var(--font-display);
        font-stretch: var(--display-stretch);
        font-size: var(--text-3xl);
        color: var(--ink);
      }
    }
  `,
})
export class QtyDialog {
  protected readonly ref = inject<DialogRef<QtyDialogResult>>(DialogRef);
  protected readonly data = inject<QtyDialogData>(DIALOG_DATA);
  protected readonly scale = inject(ScaleStore);

  protected readonly isWeight = this.data.product.unit !== 'pz';
  protected readonly unitLabel = UNITS[this.data.product.unit].label;
  protected readonly example = this.data.product.unit === 'kg' ? '1.250' : '0.500';
  /** Solo lo que se vende por kg se pesa, y solo si esta PC tiene báscula configurada. */
  protected readonly usesScale =
    this.data.product.unit === 'kg' && this.scale.supported && this.scale.enabled();

  /** El campo sigue a la báscula hasta que el cajero escribe a mano. Al editar, empieza a mano. */
  protected readonly following = signal(this.usesScale && !this.data.qtyBase);

  private readonly qtyInput = viewChild.required<PosQtyInput>('qty');

  protected readonly model = signal({ qtyBase: this.data.qtyBase ?? 0 });
  protected readonly qtyForm = form(this.model, (s) => {
    min(s.qtyBase, 1, { message: this.isWeight ? 'Escribe el peso' : 'Escribe la cantidad' });
  });

  protected readonly total = computed(() =>
    lineTotalCents(
      this.data.product.salePriceCents,
      this.model().qtyBase,
      unitScale(this.data.product.unit),
    ),
  );

  protected readonly scaleView = computed<'stable' | 'moving' | 'empty' | 'manual' | 'offline'>(
    () => {
      if (!this.following()) return 'manual';
      if (!this.scale.connected()) return 'offline';
      const reading = this.scale.reading();
      if (!reading || reading.grams <= 0) return 'empty';
      return reading.stable ? 'stable' : 'moving';
    },
  );

  /** Siguiendo a la báscula conectada, no se agrega hasta que el peso se estabiliza. */
  protected readonly waitingStable = computed(() => {
    const view = this.scaleView();
    return this.usesScale && (view === 'moving' || view === 'empty');
  });

  constructor() {
    afterNextRender(() => this.qtyInput().focus(), { injector: inject(Injector) });

    effect(() => {
      if (!this.following() || !this.scale.connected()) return;
      const grams = Math.max(this.scale.reading()?.grams ?? 0, 0);
      if (grams !== this.model().qtyBase) this.model.set({ qtyBase: grams });
    });
  }

  protected typedByHand(): void {
    if (this.following()) this.following.set(false);
  }

  protected useScale(): void {
    this.following.set(true);
    this.qtyInput().focus();
  }

  protected confirm(): void {
    if (this.waitingStable()) return;
    void submit(this.qtyForm, async () => {
      const qtyBase = this.model().qtyBase;
      const reading = this.scale.reading();
      const weighed =
        this.following() && this.scale.connected() && reading?.stable === true
          ? reading.grams === qtyBase
          : false;
      this.ref.close({ qtyBase, weighed });
      return undefined;
    });
  }
}
