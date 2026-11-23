import { Dialog } from '@angular/cdk/dialog';
import {
  Component,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { toApiError } from '../../core/api/api-types';
import { AuthStore } from '../../core/auth/auth-store';
import { BusinessContext } from '../../core/business/business-context';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { QtyPipe } from '../../shared/pipes/qty-pipe';
import {
  ConfirmService,
  DialogService,
  PosBusinessGate,
  PosButton,
  PosEmptyState,
  PosIcon,
  PosMoneyInput,
  PosSpinner,
  ToastService,
} from '../../shared/ui';
import { formatMoney } from '../../shared/utils/format';
import { UNITS, parseQtyToBase } from '../../shared/utils/qty';
import { Cart, type CartLine } from './cart';
import { parseMultiplier } from './catalog-search';
import { CashSessionStore } from './cash-session-store';
import { type PaymentDialogData, PaymentDialog, type PaymentResult } from './payment-dialog';
import { PosCatalog } from './pos-catalog';
import { type PosProduct, saleFolio, sessionFolio } from './pos-models';
import { QtyDialog, type QtyDialogData, type QtyDialogResult } from './qty-dialog';

/**
 * Pantalla de venta. Pensada para teclado y lector de código de barras:
 * F2 buscar · Enter agregar · ↑/↓ elegir · F4 cantidad del último renglón · F12 cobrar.
 */
@Component({
  selector: 'pos-pos-page',
  imports: [
    PosBusinessGate,
    PosButton,
    PosIcon,
    PosSpinner,
    PosEmptyState,
    PosMoneyInput,
    MoneyPipe,
    QtyPipe,
  ],
  providers: [Cart],
  templateUrl: './pos-page.html',
  styleUrl: './pos-page.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class PosPage {
  protected readonly catalog = inject(PosCatalog);
  protected readonly cart = inject(Cart);
  protected readonly session = inject(CashSessionStore);
  protected readonly context = inject(BusinessContext);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly cdkDialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly ticketList = viewChild<ElementRef<HTMLElement>>('ticketList');

  protected readonly units = UNITS;
  protected readonly cashierName = computed(() => this.auth.user()?.name ?? '');
  protected readonly sessionLabel = computed(() => {
    const s = this.session.current();
    return s ? sessionFolio(s.folio) : '';
  });

  // ---- Búsqueda / cuadrícula -------------------------------------------------
  protected readonly term = signal('');
  protected readonly category = signal<string | null>(null);
  private readonly parsed = computed(() => parseMultiplier(this.term()));
  protected readonly multiplier = computed(() => this.parsed().qty);
  protected readonly results = computed<PosProduct[]>(() => {
    const term = this.parsed().term.trim();
    return term ? this.catalog.search(term, 60) : this.catalog.inCategory(this.category());
  });
  protected readonly searching = computed(() => this.parsed().term.trim().length > 0);
  protected readonly active = linkedSignal<number>(() =>
    this.searching() && this.results().length ? 0 : -1,
  );

  // ---- Apertura de caja ----------------------------------------------------
  protected readonly openingFloat = signal(0);
  protected readonly opening = signal(false);

  constructor() {
    // Mantener el foco en el buscador al entrar y cuando la caja queda abierta.
    effect(() => {
      if (this.session.isOpen()) this.focusSearch();
    });
    // Hacer visible el último renglón agregado.
    effect(() => {
      const key = this.cart.lastKey();
      if (key === null) return;
      afterNextRender(
        () =>
          this.ticketList()
            ?.nativeElement.querySelector(`[data-key="${key}"]`)
            ?.scrollIntoView({ block: 'nearest' }),
        { injector: this.injector },
      );
    });
  }

  // ---- Teclado ---------------------------------------------------------------
  protected onKeydown(event: KeyboardEvent): void {
    if (this.cdkDialog.openDialogs.length > 0 || !this.session.isOpen()) return;
    switch (event.key) {
      case 'F2':
        event.preventDefault();
        this.focusSearch();
        return;
      case 'F4':
        event.preventDefault();
        this.editLast();
        return;
      case 'F12':
        event.preventDefault();
        void this.checkout();
        return;
    }
    // Escribir en cualquier parte de la pantalla va al buscador (lector de código de barras).
    const target = event.target as HTMLElement | null;
    const typing = target?.closest('input, textarea, select, [contenteditable]');
    if (!typing && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const input = this.searchInput()?.nativeElement;
      if (!input) return;
      event.preventDefault();
      // Síncrono: el siguiente carácter del lector ya cae dentro del buscador.
      input.value += event.key;
      input.focus();
      this.term.set(input.value);
    }
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (count) this.active.set(Math.min(this.active() + 1, count - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.active.set(Math.max(this.active() - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        // Lee el texto directo del input: con lector, el signal puede ir un tecleo atrás.
        this.term.set((event.target as HTMLInputElement).value);
        const product = this.results()[Math.max(this.active(), 0)];
        if (this.searching() && product) void this.pick(product);
        else if (this.searching()) {
          this.toast.warning(`Sin resultados para "${this.parsed().term.trim()}"`);
          this.resetSearch();
        }
        break;
      }
      case 'Escape':
        if (this.term()) {
          event.preventDefault();
          this.resetSearch();
        }
        break;
    }
  }

  protected focusSearch(): void {
    afterNextRender(() => this.searchInput()?.nativeElement.focus(), { injector: this.injector });
  }

  /**
   * Limpia el buscador YA (también el DOM, sin esperar al render): un lector de código de barras
   * teclea el siguiente código en milisegundos y no debe pegarse al anterior ("402" + "2*402").
   */
  protected resetSearch(): void {
    const input = this.searchInput()?.nativeElement;
    if (input) input.value = '';
    this.term.set('');
  }

  // ---- Agregar productos ------------------------------------------------------
  /** Pieza: agrega 1 (o el multiplicador). Peso/volumen: pide la cantidad (o usa el multiplicador). */
  protected async pick(product: PosProduct): Promise<void> {
    const typed = this.multiplier();
    this.resetSearch();
    if (typed) {
      try {
        this.cart.add(product, parseQtyToBase(typed, product.unit));
      } catch {
        this.toast.error(
          product.unit === 'pz'
            ? 'Las piezas se venden en cantidades enteras'
            : 'Cantidad inválida: usa hasta 3 decimales',
        );
      }
      this.focusSearch();
      return;
    }
    if (product.unit === 'pz') {
      this.cart.add(product, 1);
      this.focusSearch();
      return;
    }
    const result = await this.askQty({ product });
    if (result) this.cart.add(product, result.qtyBase, result.weighed);
    this.focusSearch();
  }

  protected async editLine(line: CartLine): Promise<void> {
    if (!line.product) return;
    const result = await this.askQty({ product: line.product, qtyBase: line.qtyBase });
    if (result) this.cart.setQty(line.key, result.qtyBase, result.weighed);
    this.focusSearch();
  }

  protected step(line: CartLine, delta: number): void {
    this.cart.setQty(line.key, line.qtyBase + delta);
    this.focusSearch();
  }

  protected remove(line: CartLine): void {
    this.cart.remove(line.key);
    this.focusSearch();
  }

  private editLast(): void {
    const last = this.cart.lines().at(-1);
    if (last) void this.editLine(last);
  }

  private askQty(data: QtyDialogData): Promise<QtyDialogResult | undefined> {
    return new Promise((resolve) => {
      this.dialogs
        .open<QtyDialogResult, QtyDialogData>(QtyDialog, { data, size: 'sm' })
        .closed.subscribe((result) => resolve(result));
    });
  }

  protected async clearTicket(): Promise<void> {
    if (this.cart.isEmpty()) return;
    const ok = await this.confirm.ask({
      heading: '¿Vaciar el ticket?',
      message: 'Se quitarán todos los productos de la venta en curso.',
      confirmText: 'Vaciar',
      tone: 'danger',
    });
    if (ok) this.cart.clear();
    this.focusSearch();
  }

  // ---- Cobrar -----------------------------------------------------------------
  protected async checkout(): Promise<void> {
    if (this.cart.isEmpty()) {
      this.toast.info('Agrega productos al ticket para cobrar.');
      this.focusSearch();
      return;
    }
    if (this.cart.hasUnavailable()) {
      this.toast.warning('Quita del ticket los productos que ya no están a la venta.');
      return;
    }
    const data: PaymentDialogData = {
      totalCents: this.cart.totalCents(),
      taxCents: this.cart.taxCents(),
      itemsCount: this.cart.count(),
      items: this.cart.toSaleItems(),
    };
    const result = await new Promise<PaymentResult | undefined>((resolve) =>
      this.dialogs
        .open<PaymentResult, PaymentDialogData>(PaymentDialog, { data, size: 'md' })
        .closed.subscribe(resolve),
    );

    if (result?.kind === 'sold') {
      this.cart.clear();
      this.catalog.reload(); // existencias actualizadas
      this.toast.success(
        `Venta ${saleFolio(result.sale.folio)} · ${formatMoney(result.sale.totalCents)}`,
      );
    } else if (result?.kind === 'price-changed') {
      this.catalog.reload();
      this.toast.warning(
        'Los precios cambiaron. Se actualizó el ticket: revisa el total y vuelve a cobrar.',
      );
    } else if (result?.kind === 'no-session') {
      this.session.reload();
      this.toast.warning('Tu caja ya no está abierta. Ábrela para seguir vendiendo.');
    }
    this.focusSearch();
  }

  // ---- Abrir caja -----------------------------------------------------------
  protected async openSession(): Promise<void> {
    this.opening.set(true);
    try {
      const session = await this.session.open(this.openingFloat());
      this.toast.success(
        `Caja abierta (${sessionFolio(session.folio)}) con ${formatMoney(session.openingFloatCents)}`,
      );
    } catch (error) {
      this.toast.error(toApiError(error).message);
      this.session.reload();
    } finally {
      this.opening.set(false);
    }
  }

  protected stockClass(product: PosProduct): string {
    if (product.stock <= 0) return 'out';
    if (product.minStock > 0 && product.stock <= product.minStock) return 'low';
    return '';
  }
}
