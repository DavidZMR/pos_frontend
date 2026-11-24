import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { BusinessContext } from '../../core/business/business-context';
import { cleanParams } from '../catalog/catalog-api';
import type { PaymentMethod } from '../pos/pos-models';
import { type PresetId, presetRange, rangeLabel, todayIn } from './report-dates';
import type { Granularity, ReportParams } from './report-models';

const DEFAULT_TIMEZONE = 'America/Mexico_City';

/**
 * Filtros de los reportes (un solo renglón arriba de todo; todas las vistas usan el mismo corte).
 * Se provee en la página: cada visita empieza en "Últimos 30 días".
 */
@Injectable()
export class ReportFilters {
  private readonly context = inject(BusinessContext);
  private readonly auth = inject(AuthStore);

  /** Zona del negocio elegido; sin negocio (superadmin, todos) se usa la de México. */
  readonly timezone = computed(() => this.context.current()?.timezone ?? DEFAULT_TIMEZONE);
  readonly today = computed(() => todayIn(this.timezone()));
  /** null = todos los negocios (solo superadmin sin negocio elegido). */
  readonly businessId = computed(() => this.context.scope());
  readonly allBusinesses = computed(() => this.auth.isSuperadmin() && !this.context.scope());

  readonly preset = signal<PresetId>('last30');
  private readonly customRange = signal<{ from: string; to: string } | null>(null);
  readonly granularity = signal<Granularity | ''>('');
  readonly categoryId = signal('');
  readonly productId = signal('');
  readonly cashierId = signal('');
  readonly method = signal<PaymentMethod | ''>('');

  readonly range = computed(() => {
    const preset = this.preset();
    const custom = this.customRange();
    if (preset === 'custom' && custom) return custom;
    return presetRange(preset === 'custom' ? 'last30' : preset, this.today());
  });
  readonly rangeText = computed(() => rangeLabel(this.range().from, this.range().to));

  /** Parámetros para el API (solo los filtros con valor). */
  readonly params = computed<ReportParams>(() => {
    const { from, to } = this.range();
    return cleanParams({
      from,
      to,
      granularity: this.granularity(),
      categoryId: this.categoryId(),
      productId: this.productId(),
      cashierId: this.cashierId(),
      method: this.method(),
    }) as unknown as ReportParams;
  });

  /**
   * Parámetros de petición: los filtros + el negocio. El negocio viaja en el encabezado, pero
   * se agrega aquí para que la URL cambie y se vuelva a pedir al cambiar de negocio (el
   * backend ignora la clave `scope`).
   */
  readonly query = computed(() => ({ ...this.params(), scope: this.businessId() ?? 'all' }));

  readonly hasExtraFilters = computed(() =>
    Boolean(this.categoryId() || this.productId() || this.cashierId() || this.method()),
  );

  selectPreset(preset: PresetId): void {
    if (preset === 'custom') this.customRange.set(this.range());
    this.preset.set(preset);
  }

  setFrom(from: string): void {
    if (!from) return;
    const to = this.range().to;
    this.customRange.set({ from, to: from > to ? from : to });
    this.preset.set('custom');
  }

  setTo(to: string): void {
    if (!to) return;
    const from = this.range().from;
    this.customRange.set({ from: to < from ? to : from, to });
    this.preset.set('custom');
  }

  clearExtraFilters(): void {
    this.categoryId.set('');
    this.productId.set('');
    this.cashierId.set('');
    this.method.set('');
  }
}
