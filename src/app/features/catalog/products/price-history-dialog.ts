import { DIALOG_DATA } from '@angular/cdk/dialog';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { type Page, toPage } from '../../../core/api/api-types';
import {
  type BadgeTone,
  PosBadge,
  PosCellDef,
  PosDialog,
  PosTable,
  type TableColumn,
} from '../../../shared/ui';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { UNITS } from '../../../shared/utils/qty';
import { CatalogApi } from '../catalog-api';
import type { PriceChange, Product } from '../catalog-models';

const SOURCE: Record<PriceChange['source'], { label: string; tone: BadgeTone }> = {
  create: { label: 'Alta', tone: 'neutral' },
  manual: { label: 'Edición', tone: 'brand' },
  purchase: { label: 'Entrada', tone: 'success' },
};

@Component({
  selector: 'pos-price-history-dialog',
  imports: [PosDialog, PosTable, PosCellDef, PosBadge, MoneyPipe],
  template: `
    <pos-dialog
      [heading]="'Historial de precios'"
      [description]="product.code + ' · ' + product.name + ' (por ' + unitLabel + ')'"
    >
      <pos-table
        caption="Historial de precios"
        [columns]="columns"
        [rows]="rows()"
        [loading]="history.isLoading()"
        [page]="meta()"
        (pageChange)="page.set($event)"
        emptyTitle="Sin cambios registrados"
      >
        <ng-template posCell="source" [posCellOf]="rows()" let-change>
          <pos-badge [tone]="source[change.source].tone">
            {{ source[change.source].label }}{{ change.refFolio ? ' ' + change.refFolio : '' }}
          </pos-badge>
        </ng-template>
        <ng-template posCell="salePriceCents" [posCellOf]="rows()" let-change>
          <span class="change num">
            @if (
              change.previousSalePriceCents !== null &&
              change.previousSalePriceCents !== change.salePriceCents
            ) {
              <span class="before">{{ change.previousSalePriceCents | money }}</span> →
            }
            <strong>{{ change.salePriceCents | money }}</strong>
          </span>
        </ng-template>
        <ng-template posCell="costCents" [posCellOf]="rows()" let-change>
          <span class="change num">
            @if (
              change.previousCostCents !== null && change.previousCostCents !== change.costCents
            ) {
              <span class="before">{{ change.previousCostCents | money }}</span> →
            }
            {{ change.costCents | money }}
          </span>
        </ng-template>
      </pos-table>
    </pos-dialog>
  `,
  styles: `
    .change {
      white-space: nowrap;
    }
    .before {
      color: var(--ink-muted);
      text-decoration: line-through;
    }
  `,
})
export class PriceHistoryDialog {
  protected readonly product = inject<Product>(DIALOG_DATA);
  private readonly api = inject(CatalogApi);
  protected readonly unitLabel = UNITS[this.product.unit].label;
  protected readonly source = SOURCE;
  protected readonly page = signal(1);

  protected readonly history = httpResource<Page<PriceChange>>(
    () => ({
      url: `${this.api.productsUrl}/${this.product.id}/price-history`,
      params: { page: this.page(), limit: 10 },
    }),
    { parse: (body) => toPage<PriceChange>(body) },
  );

  protected readonly rows = computed(() =>
    this.history.hasValue() ? this.history.value().items : [],
  );
  protected readonly meta = computed(() =>
    this.history.hasValue() ? this.history.value().meta : undefined,
  );

  protected readonly columns: TableColumn<PriceChange>[] = [
    { key: 'createdAt', header: 'Fecha', type: 'datetime', width: '11rem' },
    { key: 'source', header: 'Origen', width: '10rem' },
    { key: 'salePriceCents', header: 'Precio venta', align: 'end' },
    { key: 'costCents', header: 'Costo', align: 'end', hideOnMobile: true },
    { key: 'userName', header: 'Usuario', hideOnMobile: true },
  ];
}
