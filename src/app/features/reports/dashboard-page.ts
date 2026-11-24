import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type Page, toPage, unwrap } from '../../core/api/api-types';
import { BusinessContext } from '../../core/business/business-context';
import { ConfigService } from '../../core/config/config-service';
import type { ChartSlot } from '../../shared/charts/chart-config';
import { deltaBp, formatBp, formatCount, plural } from '../../shared/charts/chart-format';
import { PosKpi } from '../../shared/charts/kpi';
import { PosRankedBars, type RankedBar } from '../../shared/charts/ranked-bars';
import { PosSegmentedBar, type Segment } from '../../shared/charts/segmented-bar';
import { PosTrendChart } from '../../shared/charts/trend-chart';
import { PosBadge, PosButton, PosCard, PosPageHeader } from '../../shared/ui';
import { formatDateTime, formatMoney, formatQty } from '../../shared/utils/format';
import type { Product } from '../catalog/catalog-models';
import { type CashSession, PAYMENT_LABEL, PAYMENT_METHODS, sessionFolio } from '../pos/pos-models';
import {
  addDays,
  periodLabel,
  presetRange,
  rangeLabel,
  sameDaysLastMonth,
  timeIn,
  timeLabel,
  todayIn,
} from './report-dates';
import type {
  BusinessesReport,
  PaymentsReport,
  SalesSeries,
  SummaryReport,
  TopProductsReport,
} from './report-models';
import { ReportsApi } from './reports-api';

/** Productos bajo mínimo que se listan; el resto se resume en "y N más". */
const LOW_STOCK_SHOWN = 6;

/**
 * Tablero: cómo va hoy, la tendencia del mes y lo que hay que atender (existencias, cajas).
 * Las comparaciones son justas: hoy contra ayer A LA MISMA HORA y el mes contra los mismos días
 * del mes anterior (también cortados a esta hora).
 */
@Component({
  selector: 'pos-dashboard-page',
  imports: [
    RouterLink,
    PosBadge,
    PosButton,
    PosCard,
    PosKpi,
    PosPageHeader,
    PosRankedBars,
    PosSegmentedBar,
    PosTrendChart,
  ],
  template: `
    <pos-page-header eyebrow="General" heading="Tablero" [description]="description()">
      <a posButton headerActions variant="secondary" icon="chart" routerLink="/reportes"
        >Ver reportes</a
      >
    </pos-page-header>

    @if (todayKpis(); as k) {
      <div class="kpis">
        <pos-kpi
          label="Ventas de hoy"
          [value]="k.sales"
          [deltaBp]="k.salesDelta"
          previousLabel="vs. ayer a esta hora"
          [hero]="true"
        />
        <pos-kpi
          label="Tickets de hoy"
          [value]="k.tickets"
          [deltaBp]="k.ticketsDelta"
          previousLabel="vs. ayer a esta hora"
        />
        <pos-kpi
          label="Ticket promedio"
          [value]="k.avg"
          [deltaBp]="k.avgDelta"
          previousLabel="vs. ayer a esta hora"
        />
        <pos-kpi label="Ganancia de hoy" [value]="k.profit" [hint]="k.margin" />
        @if (monthKpi(); as m) {
          <pos-kpi
            label="Ventas del mes"
            [value]="m.sales"
            [deltaBp]="m.delta"
            [previousLabel]="m.vs"
          />
        }
      </div>
    }

    <div class="grid">
      <pos-card heading="Ventas de los últimos 30 días" class="wide">
        <pos-trend-chart
          kind="line"
          [labels]="trendLabels()"
          [series]="trendSeries()"
          [loading]="trend.isLoading()"
          ariaLabel="Ventas por día de los últimos 30 días"
        />
      </pos-card>
      <pos-card heading="Formas de pago de hoy">
        <pos-segmented-bar
          [segments]="methods()"
          [loading]="payments.isLoading()"
          ariaLabel="Ventas de hoy por forma de pago"
        />
      </pos-card>
      <pos-card heading="Lo más vendido este mes">
        <pos-ranked-bars
          [items]="topBars()"
          [loading]="top.isLoading()"
          ariaLabel="Productos más vendidos este mes"
        />
      </pos-card>

      @if (businessBars(); as bars) {
        <pos-card heading="Negocios este mes" class="wide">
          <pos-ranked-bars
            [items]="bars"
            [loading]="businesses.isLoading()"
            ariaLabel="Ventas por negocio este mes"
          />
        </pos-card>
      }

      @if (context.scope()) {
        <pos-card heading="Existencias bajas">
          <a cardActions posButton variant="ghost" size="sm" routerLink="/almacen/existencias"
            >Ver existencias</a
          >
          @if (lowStock().length) {
            <ul class="list">
              @for (p of lowStock(); track p.id) {
                <li>
                  <span class="name">{{ p.name }}</span>
                  <pos-badge [tone]="p.stock <= 0 ? 'danger' : 'warning'">{{
                    p.stock <= 0 ? 'Agotado' : 'Bajo mínimo'
                  }}</pos-badge>
                  <span class="num muted"
                    >{{ qty(p.stock, p.unit) }} / mín. {{ qty(p.minStock, p.unit) }}</span
                  >
                </li>
              }
            </ul>
            @if (lowStockMore(); as more) {
              <a class="more" routerLink="/almacen/existencias" [queryParams]="{ stock: 'low' }"
                >y {{ more }} más bajo mínimo</a
              >
            }
          } @else {
            <p class="muted">Todo en orden: ningún producto bajo su mínimo.</p>
          }
        </pos-card>
        <pos-card heading="Cajas abiertas">
          <a cardActions posButton variant="ghost" size="sm" routerLink="/caja">Ver caja</a>
          @if (openSessions().length) {
            <ul class="list">
              @for (s of openSessions(); track s.id) {
                <li>
                  <span class="name">{{ s.userName }}</span>
                  <span class="num code">{{ folio(s.folio) }}</span>
                  <span class="muted">desde {{ when(s.openedAt) }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="muted">No hay cajas abiertas.</p>
          }
        </pos-card>
      }
    </div>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }
    .kpis > :first-child {
      grid-column: span 2;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
      gap: var(--space-5);
      align-items: start;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .list {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: var(--text-sm);
    }
    .list li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--line);
    }
    .list li:last-child {
      border-bottom: none;
    }
    .more {
      display: inline-block;
      margin-top: var(--space-2);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--brand-ink);
    }
    .name {
      flex: 1;
      min-width: 8rem;
      font-weight: 600;
    }
    @media (max-width: 640px) {
      .kpis > :first-child {
        grid-column: auto;
      }
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(ReportsApi);
  private readonly config = inject(ConfigService);
  protected readonly context = inject(BusinessContext);

  private readonly timezone = computed(
    () => this.context.current()?.timezone ?? 'America/Mexico_City',
  );
  private readonly today = computed(() => todayIn(this.timezone()));
  /** Hora local al abrir el tablero: hasta aquí se cortan hoy, ayer y los días del mes anterior. */
  private readonly now = computed(() => timeIn(this.timezone()));
  private readonly scope = computed(() => this.context.scope() ?? 'all');
  protected readonly qty = formatQty;
  protected readonly when = formatDateTime;
  protected readonly folio = sessionFolio;

  protected readonly description = computed(
    () =>
      `${this.context.current()?.name ?? 'Todos los negocios'} · hoy ${rangeLabel(this.today(), this.today())}, ${timeLabel(this.now())}`,
  );

  private readonly todaySummary = httpResource<SummaryReport>(
    () => ({
      url: this.api.url('summary'),
      // El periodo anterior de un día es ayer; `until` corta los dos a esta hora.
      params: { from: this.today(), to: this.today(), until: this.now(), scope: this.scope() },
    }),
    { parse: (body) => unwrap<SummaryReport>(body) },
  );
  private readonly monthSummary = httpResource<SummaryReport>(
    () => {
      const compare = sameDaysLastMonth(this.today());
      return {
        url: this.api.url('summary'),
        params: {
          ...presetRange('thisMonth', this.today()),
          until: this.now(),
          compareFrom: compare.from,
          compareTo: compare.to,
          scope: this.scope(),
        },
      };
    },
    { parse: (body) => unwrap<SummaryReport>(body) },
  );
  protected readonly trend = httpResource<SalesSeries>(
    () => ({
      url: this.api.url('sales-series'),
      params: {
        from: addDays(this.today(), -29),
        to: this.today(),
        granularity: 'day',
        scope: this.scope(),
      },
    }),
    { parse: (body) => unwrap<SalesSeries>(body) },
  );
  protected readonly payments = httpResource<PaymentsReport>(
    () => ({
      url: this.api.url('payments'),
      params: { from: this.today(), to: this.today(), scope: this.scope() },
    }),
    { parse: (body) => unwrap<PaymentsReport>(body) },
  );
  protected readonly top = httpResource<TopProductsReport>(
    () => ({
      url: this.api.url('top-products'),
      params: { ...presetRange('thisMonth', this.today()), limit: 5, scope: this.scope() },
    }),
    { parse: (body) => unwrap<TopProductsReport>(body) },
  );
  protected readonly businesses = httpResource<BusinessesReport>(
    () =>
      this.context.scope()
        ? undefined
        : { url: this.api.url('businesses'), params: presetRange('thisMonth', this.today()) },
    { parse: (body) => unwrap<BusinessesReport>(body) },
  );
  private readonly lowStockResource = httpResource<Page<Product>>(
    () =>
      this.context.scope()
        ? {
            url: this.config.api('/products'),
            params: { stock: 'low', limit: LOW_STOCK_SHOWN, active: true, scope: this.scope() },
          }
        : undefined,
    { parse: (body) => toPage<Product>(body) },
  );
  private readonly sessionsResource = httpResource<Page<CashSession>>(
    () =>
      this.context.scope()
        ? {
            url: this.config.api('/cash-sessions'),
            params: { status: 'open', limit: 10, scope: this.scope() },
          }
        : undefined,
    { parse: (body) => toPage<CashSession>(body) },
  );

  protected readonly todayKpis = computed(() => {
    if (!this.todaySummary.hasValue()) return null;
    const { totals: t, previous } = this.todaySummary.value();
    const p = previous.totals;
    return {
      sales: formatMoney(t.salesCents),
      salesDelta: deltaBp(t.salesCents, p.salesCents),
      tickets: formatCount(t.tickets),
      ticketsDelta: deltaBp(t.tickets, p.tickets),
      avg: formatMoney(t.avgTicketCents),
      avgDelta: deltaBp(t.avgTicketCents, p.avgTicketCents),
      profit: formatMoney(t.profitCents),
      margin: `Margen ${formatBp(t.marginBp)}`,
    };
  });
  protected readonly monthKpi = computed(() => {
    if (!this.monthSummary.hasValue()) return null;
    const { totals, previous } = this.monthSummary.value();
    return {
      sales: formatMoney(totals.salesCents),
      delta: deltaBp(totals.salesCents, previous.totals.salesCents),
      vs: `vs. ${rangeLabel(previous.from, previous.to)} a esta hora`,
    };
  });

  protected readonly trendLabels = computed(() =>
    this.trend.hasValue() ? this.trend.value().points.map((p) => periodLabel(p.period, 'day')) : [],
  );
  protected readonly trendSeries = computed(() => [
    {
      label: 'Ventas',
      values: this.trend.hasValue() ? this.trend.value().points.map((p) => p.salesCents) : [],
      slot: 1 as const,
    },
  ]);
  protected readonly methods = computed<Segment[]>(() =>
    this.payments.hasValue()
      ? this.payments.value().byMethod.map((m) => ({
          id: m.method,
          label: PAYMENT_LABEL[m.method].label,
          value: m.amountCents,
          valueText: formatMoney(m.amountCents),
          slot: (PAYMENT_METHODS.indexOf(m.method) + 1) as ChartSlot,
        }))
      : [],
  );
  protected readonly topBars = computed<RankedBar[]>(() =>
    this.top.hasValue()
      ? this.top.value().items.map((p) => ({
          id: p.productId,
          label: p.name,
          sublabel: formatQty(p.qtyBase, p.unit),
          value: p.salesCents,
          valueText: formatMoney(p.salesCents),
          detail: formatBp(p.shareBp),
        }))
      : [],
  );
  protected readonly businessBars = computed<RankedBar[] | null>(() =>
    this.context.scope() || !this.businesses.hasValue()
      ? null
      : this.businesses.value().items.map((b) => ({
          id: b.businessId,
          label: b.name,
          sublabel: `${plural(b.tickets, 'ticket', 'tickets')} · margen ${formatBp(b.marginBp)}`,
          value: b.salesCents,
          valueText: formatMoney(b.salesCents),
          detail: formatBp(b.shareBp),
        })),
  );
  protected readonly lowStock = computed(() =>
    this.lowStockResource.hasValue() ? this.lowStockResource.value().items : [],
  );
  /** Cuántos más hay bajo mínimo además de los que se listan (0 = ninguno). */
  protected readonly lowStockMore = computed(() =>
    this.lowStockResource.hasValue()
      ? Math.max(0, this.lowStockResource.value().meta.total - this.lowStock().length)
      : 0,
  );
  protected readonly openSessions = computed(() =>
    this.sessionsResource.hasValue() ? this.sessionsResource.value().items : [],
  );
}
