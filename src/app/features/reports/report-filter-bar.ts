import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { type Page, toPage } from '../../core/api/api-types';
import type { User } from '../../core/auth/auth-models';
import { ConfigService } from '../../core/config/config-service';
import { PosButton, PosInput, PosSelect, type SelectOption } from '../../shared/ui';
import { CatalogLookups } from '../catalog/catalog-lookups';
import { PosCatalog } from '../pos/pos-catalog';
import { PAYMENT_LABEL, PAYMENT_METHODS, type PaymentMethod } from '../pos/pos-models';
import { PRESETS, type PresetId } from './report-dates';
import { GRANULARITY_LABEL, type Granularity } from './report-models';
import { ReportFilters } from './report-filters';

/**
 * Un solo renglón de filtros arriba de todos los reportes (el rango primero). Categoría,
 * producto y cajero solo con un negocio elegido (sus listas son de ese negocio).
 */
@Component({
  selector: 'pos-report-filter-bar',
  imports: [PosButton, PosInput, PosSelect],
  template: `
    <div class="pos-filters">
      <pos-select
        label="Periodo"
        [options]="presetOptions"
        [value]="filters.preset()"
        (valueChange)="filters.selectPreset($any($event))"
      />
      <pos-input
        label="Desde"
        type="date"
        [value]="filters.range().from"
        (valueChange)="filters.setFrom($event)"
      />
      <pos-input
        label="Hasta"
        type="date"
        [value]="filters.range().to"
        (valueChange)="filters.setTo($event)"
      />
      <pos-select
        label="Agrupar por"
        [options]="granularityOptions"
        [value]="filters.granularity()"
        (valueChange)="filters.granularity.set($any($event))"
      />
      @if (!filters.allBusinesses()) {
        <pos-select
          label="Categoría"
          [options]="categoryOptions()"
          [value]="filters.categoryId()"
          (valueChange)="filters.categoryId.set($event)"
        />
        <pos-select
          label="Producto"
          [options]="productOptions()"
          [value]="filters.productId()"
          (valueChange)="filters.productId.set($event)"
        />
        <pos-select
          label="Cajero"
          [options]="cashierOptions()"
          [value]="filters.cashierId()"
          (valueChange)="filters.cashierId.set($event)"
        />
      }
      <pos-select
        label="Forma de pago"
        [options]="methodOptions"
        [value]="filters.method()"
        (valueChange)="filters.method.set($any($event))"
      />
      @if (filters.hasExtraFilters()) {
        <button
          posButton
          variant="ghost"
          icon="x"
          class="clear"
          (click)="filters.clearExtraFilters()"
        >
          Quitar filtros
        </button>
      }
    </div>
  `,
  styles: `
    .clear {
      align-self: flex-end;
    }
  `,
})
export class PosReportFilterBar {
  protected readonly filters = inject(ReportFilters);
  private readonly lookups = inject(CatalogLookups);
  private readonly catalog = inject(PosCatalog);
  private readonly config = inject(ConfigService);

  protected readonly presetOptions: SelectOption[] = PRESETS.map((p) => ({
    value: p.id satisfies PresetId,
    label: p.label,
  }));
  protected readonly granularityOptions: SelectOption[] = [
    { value: '', label: 'Automático' },
    ...(Object.keys(GRANULARITY_LABEL) as Granularity[]).map((g) => ({
      value: g,
      label: GRANULARITY_LABEL[g],
    })),
  ];
  protected readonly methodOptions: SelectOption[] = [
    { value: '', label: 'Todas' },
    ...PAYMENT_METHODS.map((m: PaymentMethod) => ({ value: m, label: PAYMENT_LABEL[m].label })),
  ];

  protected readonly categoryOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todas' },
    ...this.lookups.categoryOptions(),
  ]);
  protected readonly productOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todos' },
    ...[...this.catalog.products()]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
  ]);

  /** Usuarios del negocio (cajeros, y el admin, que también puede vender). */
  private readonly users = httpResource<Page<User>>(
    () =>
      this.filters.allBusinesses()
        ? undefined
        : {
            url: this.config.api('/users'),
            // El negocio en los parámetros: al cambiarlo (superadmin) se vuelve a pedir la lista.
            params: { limit: 100, businessId: this.filters.businessId() ?? '' },
          },
    { parse: (body) => toPage<User>(body) },
  );
  protected readonly cashierOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todos' },
    ...(this.users.hasValue() ? this.users.value().items : [])
      .filter((u) => u.role !== 'superadmin')
      .map((u) => ({ value: u.id, label: u.name })),
  ]);
}
