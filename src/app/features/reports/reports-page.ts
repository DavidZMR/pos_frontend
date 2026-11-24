import { Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { BusinessContext } from '../../core/business/business-context';
import { PosButton, PosPageHeader, ToastService } from '../../shared/ui';
import { ReportExporter } from './excel/report-exporter';
import { PosReportFilterBar } from './report-filter-bar';
import { ReportFilters } from './report-filters';
import { BusinessesView } from './views/businesses-view';
import { PaymentsView } from './views/payments-view';
import { ProductsView } from './views/products-view';
import { PurchasesView } from './views/purchases-view';
import { SummaryView } from './views/summary-view';

type Tab = 'summary' | 'products' | 'payments' | 'purchases' | 'businesses';

/** Reportes del negocio (admin) o de todos / uno (superadmin), con exportación a Excel. */
@Component({
  selector: 'pos-reports-page',
  imports: [
    PosButton,
    PosPageHeader,
    PosReportFilterBar,
    BusinessesView,
    PaymentsView,
    ProductsView,
    PurchasesView,
    SummaryView,
  ],
  providers: [ReportFilters],
  template: `
    <pos-page-header eyebrow="Reportes" heading="Reportes" [description]="description()">
      <button
        posButton
        headerActions
        icon="file-spreadsheet"
        [loading]="exporting()"
        (click)="exportExcel()"
      >
        Exportar a Excel
      </button>
    </pos-page-header>

    <pos-report-filter-bar />

    <div class="tabs" role="tablist" aria-label="Vistas de reportes" (keydown)="onTabKey($event)">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="tab"
          [id]="'tab-' + tab.id"
          [attr.aria-selected]="active() === tab.id"
          [attr.aria-controls]="'panel-' + tab.id"
          [attr.tabindex]="active() === tab.id ? 0 : -1"
          (click)="active.set(tab.id)"
        >
          {{ tab.label }}
        </button>
      }
    </div>

    <section
      class="panel"
      role="tabpanel"
      [id]="'panel-' + active()"
      [attr.aria-labelledby]="'tab-' + active()"
    >
      @switch (active()) {
        @case ('summary') {
          <pos-summary-view />
        }
        @case ('products') {
          <pos-products-view />
        }
        @case ('payments') {
          <pos-payments-view />
        }
        @case ('purchases') {
          <pos-purchases-view />
        }
        @case ('businesses') {
          <pos-businesses-view />
        }
      }
    </section>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: var(--space-1);
      margin: var(--space-5) 0 var(--space-5);
      border-bottom: var(--border);
      overflow-x: auto;
    }
    .tab {
      flex: none;
      padding: var(--space-3) var(--space-4);
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      color: var(--ink-muted);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition:
        color var(--dur-fast) var(--ease-out),
        border-color var(--dur-fast) var(--ease-out);
    }
    .tab:hover {
      color: var(--ink);
      border-bottom-color: var(--line-strong);
    }
    .tab[aria-selected='true'] {
      color: var(--brand-ink);
      border-bottom-color: var(--brand);
    }
    .tab:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: -2px;
    }
  `,
})
export class ReportsPage {
  private readonly auth = inject(AuthStore);
  private readonly context = inject(BusinessContext);
  private readonly toast = inject(ToastService);
  private readonly exporter = inject(ReportExporter);
  protected readonly filters = inject(ReportFilters);

  protected readonly active = signal<Tab>('summary');
  protected readonly exporting = signal(false);

  protected readonly tabs = computed(() => [
    { id: 'summary' as const, label: 'Resumen' },
    { id: 'products' as const, label: 'Productos' },
    { id: 'payments' as const, label: 'Pagos y horarios' },
    { id: 'purchases' as const, label: 'Compras' },
    ...(this.auth.isSuperadmin() ? [{ id: 'businesses' as const, label: 'Negocios' }] : []),
  ]);

  protected readonly description = computed(() => {
    const scope = this.filters.allBusinesses()
      ? 'Todos los negocios'
      : (this.context.current()?.name ?? '');
    return `${scope} · ${this.filters.rangeText()}. Las cifras usan el precio y costo de cada venta.`;
  });

  /** Flechas izquierda/derecha entre pestañas (patrón ARIA de pestañas). */
  protected onTabKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const ids = this.tabs().map((t) => t.id);
    const index = ids.indexOf(this.active());
    const next = ids[
      (index + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length
    ] as Tab;
    this.active.set(next);
    queueMicrotask(() => document.getElementById(`tab-${next}`)?.focus());
    event.preventDefault();
  }

  protected async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const name = this.filters.allBusinesses()
        ? 'Todos los negocios'
        : (this.context.current()?.name ?? 'Negocio');
      const file = await this.exporter.export(this.filters, name);
      this.toast.success(`Reporte exportado: ${file}`);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo exportar');
    } finally {
      this.exporting.set(false);
    }
  }
}
