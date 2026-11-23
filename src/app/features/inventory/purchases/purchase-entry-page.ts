import {
  Component,
  afterNextRender,
  computed,
  inject,
  Injector,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  FormField,
  applyEach,
  form,
  maxLength,
  min,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { toApiError } from '../../../core/api/api-types';
import { BusinessContext } from '../../../core/business/business-context';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { QtyPipe } from '../../../shared/pipes/qty-pipe';
import {
  ConfirmService,
  PosAutocomplete,
  PosBadge,
  PosBusinessGate,
  PosButton,
  PosCard,
  PosEmptyState,
  PosInput,
  PosMoneyInput,
  PosOptionDef,
  PosPageHeader,
  PosQtyInput,
  PosSelect,
  PosTextarea,
  ToastService,
} from '../../../shared/ui';
import { formatMoney } from '../../../shared/utils/format';
import { lineTotalCents } from '../../../shared/utils/money';
import { UNITS, type Unit, unitScale } from '../../../shared/utils/qty';
import { CatalogApi } from '../../catalog/catalog-api';
import { CatalogLookups } from '../../catalog/catalog-lookups';
import type { Product } from '../../catalog/catalog-models';
import { InventoryApi, type PurchaseLineInput } from '../inventory-api';

interface Line {
  productId: string;
  code: string;
  name: string;
  unit: Unit;
  stock: number;
  currentCostCents: number;
  currentSalePriceCents: number;
  qtyBase: number;
  unitCostCents: number;
  newSalePriceCents: number;
}

function todayIn(timeZone: string | undefined): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

@Component({
  selector: 'pos-purchase-entry-page',
  imports: [
    FormField,
    RouterLink,
    PosBusinessGate,
    PosPageHeader,
    PosCard,
    PosAutocomplete,
    PosOptionDef,
    PosSelect,
    PosInput,
    PosTextarea,
    PosQtyInput,
    PosMoneyInput,
    PosButton,
    PosBadge,
    PosEmptyState,
    MoneyPipe,
    QtyPipe,
  ],
  templateUrl: './purchase-entry-page.html',
  styleUrl: './purchase-entry-page.scss',
})
export class PurchaseEntryPage {
  private readonly catalog = inject(CatalogApi);
  private readonly inventory = inject(InventoryApi);
  protected readonly lookups = inject(CatalogLookups);
  protected readonly context = inject(BusinessContext);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  private readonly picker = viewChild(PosAutocomplete);
  private readonly qtyInputs = viewChildren(PosQtyInput);

  protected readonly units = UNITS;
  protected readonly saving = signal(false);
  protected readonly today = todayIn(this.context.current()?.timezone);
  protected readonly productSample: Product[] = [];

  protected readonly supplierOptions = computed(() => [
    { value: '', label: 'Sin proveedor' },
    ...this.lookups.supplierOptions(),
  ]);

  protected readonly model = signal({
    supplierId: '',
    purchaseDate: this.today,
    invoiceNumber: '',
    notes: '',
    items: [] as Line[],
  });

  protected readonly entryForm = form(this.model, (s) => {
    maxLength(s.invoiceNumber, 40, { message: 'Máximo 40 caracteres' });
    maxLength(s.notes, 500, { message: 'Máximo 500 caracteres' });
    validate(s.purchaseDate, ({ value }) => {
      if (!value()) return { kind: 'required', message: 'Elige la fecha' };
      if (value() > this.today) return { kind: 'future', message: 'No puede ser una fecha futura' };
      return undefined;
    });
    applyEach(s.items, (item) => {
      min(item.qtyBase, 1, { message: 'Escribe la cantidad' });
      min(item.newSalePriceCents, 1, { message: 'Escribe el precio' });
    });
  });

  protected readonly totals = computed(() => {
    const items = this.model().items;
    return {
      lines: items.length,
      totalCents: items.reduce(
        (sum, line) => sum + lineTotalCents(line.unitCostCents, line.qtyBase, unitScale(line.unit)),
        0,
      ),
      priceChanges: items.filter((l) => l.newSalePriceCents !== l.currentSalePriceCents).length,
    };
  });

  protected readonly searchProducts = (term: string) => this.catalog.searchProducts(term, 8);

  protected lineTotal(line: Line): number {
    return lineTotalCents(line.unitCostCents, line.qtyBase, unitScale(line.unit));
  }

  protected margin(line: Line): string | null {
    if (line.newSalePriceCents <= 0 || line.unitCostCents <= 0) return null;
    return (((line.newSalePriceCents - line.unitCostCents) / line.newSalePriceCents) * 100).toFixed(
      1,
    );
  }

  protected addProduct(product: Product): void {
    const index = this.model().items.findIndex((l) => l.productId === product.id);
    if (index >= 0) {
      this.toast.info(`"${product.name}" ya está en la lista; ajusta su cantidad.`);
      this.focusQty(index);
      return;
    }
    this.model.update((m) => ({
      ...m,
      items: [
        ...m.items,
        {
          productId: product.id,
          code: product.code,
          name: product.name,
          unit: product.unit,
          stock: product.stock,
          currentCostCents: product.costCents,
          currentSalePriceCents: product.salePriceCents,
          qtyBase: 0,
          unitCostCents: product.costCents,
          newSalePriceCents: product.salePriceCents,
        },
      ],
    }));
    this.focusQty(this.model().items.length - 1);
  }

  protected removeLine(index: number): void {
    this.model.update((m) => ({ ...m, items: m.items.filter((_, i) => i !== index) }));
  }

  /** Enter dentro de un renglón regresa al buscador para capturar el siguiente producto. */
  protected nextProduct(event: Event): void {
    event.preventDefault();
    (event.target as HTMLElement).blur();
    this.picker()?.focus();
  }

  private focusQty(index: number): void {
    afterNextRender(() => this.qtyInputs()[index]?.focus(), { injector: this.injector });
  }

  protected async discard(): Promise<void> {
    if (this.model().items.length) {
      const ok = await this.confirm.ask({
        heading: '¿Descartar la entrada?',
        message: 'Se perderán los productos capturados.',
        confirmText: 'Descartar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    await this.router.navigateByUrl('/almacen/entradas');
  }

  protected save(): void {
    if (!this.model().items.length) {
      this.toast.warning('Agrega al menos un producto a la entrada.');
      this.picker()?.focus();
      return;
    }
    void submit(this.entryForm, async () => {
      this.saving.set(true);
      try {
        const m = this.model();
        const items: PurchaseLineInput[] = m.items.map((line) => ({
          productId: line.productId,
          qtyBase: line.qtyBase,
          unitCostCents: line.unitCostCents,
          ...(line.newSalePriceCents !== line.currentSalePriceCents && {
            newSalePriceCents: line.newSalePriceCents,
          }),
        }));
        const { message } = await this.inventory.createPurchase({
          supplierId: m.supplierId || null,
          invoiceNumber: m.invoiceNumber.trim(),
          notes: m.notes.trim(),
          purchaseDate: m.purchaseDate,
          items,
        });
        this.toast.success(`${message} · ${formatMoney(this.totals().totalCents)}`);
        await this.router.navigateByUrl('/almacen/entradas');
      } catch (error) {
        this.toast.error(toApiError(error).message);
      } finally {
        this.saving.set(false);
      }
      return undefined;
    });
  }
}
