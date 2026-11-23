import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { QtyPipe } from '../../../shared/pipes/qty-pipe';
import {
  DialogService,
  PosBadge,
  PosButton,
  PosCellDef,
  PosDialog,
  PosTable,
  type TableColumn,
} from '../../../shared/ui';
import { formatDateTime } from '../../../shared/utils/format';
import { UNITS } from '../../../shared/utils/qty';
import { type Purchase, type PurchaseItem, purchaseFolio } from '../inventory-models';
import { CancelPurchaseDialog } from './cancel-purchase-dialog';

@Component({
  selector: 'pos-purchase-detail-dialog',
  imports: [PosDialog, PosTable, PosCellDef, PosBadge, PosButton, MoneyPipe, QtyPipe],
  template: `
    <pos-dialog [heading]="'Entrada ' + folio" [description]="when">
      <dl class="facts">
        <div>
          <dt>Proveedor</dt>
          <dd>{{ purchase().supplierName || 'Sin proveedor' }}</dd>
        </div>
        <div>
          <dt>Factura o nota</dt>
          <dd>{{ purchase().invoiceNumber || '—' }}</dd>
        </div>
        <div>
          <dt>Registró</dt>
          <dd>{{ purchase().createdByName }}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <pos-badge [tone]="purchase().status === 'active' ? 'success' : 'danger'">
              {{ purchase().status === 'active' ? 'Vigente' : 'Cancelada' }}
            </pos-badge>
          </dd>
        </div>
      </dl>

      @if (purchase().status === 'cancelled') {
        <p class="cancelled" role="note">
          Cancelada por {{ purchase().cancelledByName }}: “{{ purchase().cancelReason }}”
        </p>
      }
      @if (purchase().notes) {
        <p class="notes">{{ purchase().notes }}</p>
      }

      <pos-table caption="Productos de la entrada" [columns]="columns" [rows]="purchase().items">
        <ng-template posCell="name" [posCellOf]="purchase().items" let-item>
          <span class="cell-stack">
            <span class="primary">{{ item.name }}</span>
            <span class="secondary num">{{ item.code }}</span>
          </span>
        </ng-template>
        <ng-template posCell="qtyBase" [posCellOf]="purchase().items" let-item>
          <span class="num">{{ item.qtyBase | qty: item.unit }}</span>
        </ng-template>
        <ng-template posCell="unitCostCents" [posCellOf]="purchase().items" let-item>
          <span class="num"
            >{{ item.unitCostCents | money
            }}<span class="per">/{{ units[item.unit].label }}</span></span
          >
        </ng-template>
        <ng-template posCell="price" [posCellOf]="purchase().items" let-item>
          @if (item.newSalePriceCents !== null) {
            <span class="num nowrap">
              <span class="before">{{ item.previousSalePriceCents | money }}</span> →
              <strong>{{ item.newSalePriceCents | money }}</strong>
            </span>
          } @else {
            <span class="muted">Sin cambio</span>
          }
        </ng-template>
      </pos-table>

      <p class="total">
        Total <strong class="num">{{ purchase().totalCents | money }}</strong>
      </p>

      <ng-container dialogActions>
        @if (purchase().status === 'active') {
          <button posButton variant="danger" icon="x" type="button" (click)="cancel()">
            Cancelar entrada
          </button>
        }
        <button posButton variant="secondary" type="button" (click)="ref.close(changed)">
          Cerrar
        </button>
      </ng-container>
    </pos-dialog>
  `,
  styles: `
    .facts {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--space-3);
      margin: 0 0 var(--space-4);
    }
    dt {
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
    dd {
      margin: 2px 0 0;
      font-weight: 600;
    }
    .cancelled {
      margin-bottom: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius);
      background: var(--danger-soft);
      color: var(--danger-hover);
      font-size: var(--text-sm);
    }
    .notes {
      margin-bottom: var(--space-3);
      color: var(--ink-muted);
      font-size: var(--text-sm);
    }
    .before {
      color: var(--ink-muted);
      text-decoration: line-through;
    }
    .nowrap {
      white-space: nowrap;
    }
    .total {
      display: flex;
      justify-content: flex-end;
      align-items: baseline;
      gap: var(--space-3);
      margin-top: var(--space-4);
      color: var(--ink-muted);
      strong {
        font-family: var(--font-display);
        font-stretch: var(--display-stretch);
        font-size: var(--text-2xl);
        color: var(--ink);
      }
    }
    @media (max-width: 40rem) {
      .facts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class PurchaseDetailDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly dialogs = inject(DialogService);
  protected readonly purchase = signal(inject<Purchase>(DIALOG_DATA));
  protected readonly folio = purchaseFolio(this.purchase().folio);
  protected readonly when = `Compra del ${formatDateTime(this.purchase().purchasedAt)}`;
  protected readonly units = UNITS;
  protected changed = false;

  protected readonly columns: TableColumn<PurchaseItem>[] = [
    { key: 'name', header: 'Producto' },
    { key: 'qtyBase', header: 'Cantidad', align: 'end' },
    { key: 'unitCostCents', header: 'Costo', align: 'end' },
    { key: 'lineTotalCents', header: 'Subtotal', type: 'money' },
    { key: 'price', header: 'Precio de venta', align: 'end', hideOnMobile: true },
  ];

  protected cancel(): void {
    this.dialogs
      .open<Purchase, Purchase>(CancelPurchaseDialog, { data: this.purchase(), size: 'sm' })
      .closed.subscribe((updated) => {
        if (updated) {
          this.purchase.set(updated);
          this.changed = true;
        }
      });
  }
}
