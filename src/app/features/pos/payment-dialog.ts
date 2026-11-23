import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toApiError } from '../../core/api/api-types';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { PosButton, PosDialog, PosIcon, PosMoneyInput } from '../../shared/ui';
import { formatMoney } from '../../shared/utils/format';
import { PosApi, type SaleInput } from './pos-api';
import {
  PAYMENT_LABEL,
  PAYMENT_METHODS,
  type PaymentMethod,
  type Sale,
  saleFolio,
} from './pos-models';

export interface PaymentDialogData {
  totalCents: number;
  taxCents: number;
  itemsCount: number;
  items: SaleInput['items'];
}

export type PaymentResult =
  | { kind: 'sold'; sale: Sale }
  | { kind: 'price-changed'; totalCents: number }
  | { kind: 'no-session' };

/** Billetes sugeridos por encima del total ($600, $700, $1,000…). */
export function suggestedCash(totalCents: number): number[] {
  const steps = [5000, 10000, 20000, 50000, 100000];
  const values = new Set<number>();
  for (const step of steps) {
    const rounded = Math.ceil(totalCents / step) * step;
    if (rounded > totalCents) values.add(rounded);
  }
  return [...values].sort((a, b) => a - b).slice(0, 4);
}

@Component({
  selector: 'pos-payment-dialog',
  imports: [PosDialog, PosButton, PosIcon, PosMoneyInput, MoneyPipe],
  templateUrl: './payment-dialog.html',
  styleUrl: './payment-dialog.scss',
  host: { '(keydown.enter)': 'onEnter($event)' },
})
export class PaymentDialog {
  protected readonly ref = inject<DialogRef<PaymentResult>>(DialogRef);
  protected readonly data = inject<PaymentDialogData>(DIALOG_DATA);
  private readonly api = inject(PosApi);

  protected readonly methods = PAYMENT_METHODS;
  protected readonly labels = PAYMENT_LABEL;
  protected readonly suggestions = suggestedCash(this.data.totalCents);

  protected readonly method = signal<PaymentMethod>('cash');
  protected readonly received = signal(0);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly sale = signal<Sale | null>(null);

  private readonly receivedInput = viewChild<PosMoneyInput>('receivedInput');
  // `read: ElementRef`: #doneButton está sobre un posButton (componente), queremos el <button>.
  private readonly doneButton = viewChild('doneButton', { read: ElementRef<HTMLButtonElement> });
  private readonly injector = inject(Injector);

  /** Efectivo: si no se captura nada se asume pago exacto. */
  protected readonly cashGiven = computed(() =>
    this.received() > 0 ? this.received() : this.data.totalCents,
  );
  protected readonly change = computed(() => this.cashGiven() - this.data.totalCents);
  protected readonly missing = computed(() =>
    this.method() === 'cash' && this.change() < 0 ? -this.change() : 0,
  );
  protected readonly folio = computed(() => {
    const sale = this.sale();
    return sale ? saleFolio(sale.folio) : '';
  });

  constructor() {
    afterNextRender(() => this.receivedInput()?.focus(), { injector: this.injector });
  }

  protected selectMethod(method: PaymentMethod): void {
    this.method.set(method);
    this.error.set('');
    if (method === 'cash') {
      afterNextRender(() => this.receivedInput()?.focus(), { injector: this.injector });
    }
  }

  protected setReceived(cents: number): void {
    this.received.set(cents);
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    if (this.sale()) this.finish();
    else void this.pay();
  }

  protected async pay(): Promise<void> {
    if (this.saving() || this.sale() || this.missing() > 0) return;
    this.saving.set(true);
    this.ref.disableClose = true; // no cerrar con Esc mientras se registra
    this.error.set('');
    const isCash = this.method() === 'cash';
    try {
      const sale = await this.api.createSale({
        items: this.data.items,
        payments: [{ method: this.method(), amountCents: this.data.totalCents }],
        ...(isCash && { cashReceivedCents: this.cashGiven() }),
        expectedTotalCents: this.data.totalCents,
      });
      this.sale.set(sale);
      afterNextRender(() => this.doneButton()?.nativeElement.focus(), { injector: this.injector });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'PRICE_CHANGED') {
        this.ref.close({ kind: 'price-changed', totalCents: this.data.totalCents });
        return;
      }
      if (apiError.code === 'CASH_SESSION_REQUIRED') {
        this.ref.close({ kind: 'no-session' });
        return;
      }
      this.error.set(apiError.message);
    } finally {
      this.saving.set(false);
      // Tras cobrar solo se sale con "Nueva venta" (así el ticket siempre se limpia).
      this.ref.disableClose = this.sale() !== null;
    }
  }

  protected finish(): void {
    const sale = this.sale();
    if (sale) this.ref.close({ kind: 'sold', sale });
  }

  protected readonly changeText = computed(() => formatMoney(Math.max(this.change(), 0)));
}
