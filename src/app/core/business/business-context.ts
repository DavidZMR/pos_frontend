import { httpResource } from '@angular/common/http';
import { Service, computed, effect, inject, signal } from '@angular/core';
import { type Page, toPage } from '../api/api-types';
import type { Business } from '../auth/auth-models';
import { AuthStore } from '../auth/auth-store';
import { ConfigService } from '../config/config-service';
import { LocalStore } from '../storage';

const SELECTED_KEY = 'pos.selectedBusinessId';

/**
 * Negocio sobre el que se trabaja.
 * - admin/empleado: siempre el suyo (viene en la sesión).
 * - superadmin: elige uno en la barra superior; se envía como `x-business-id`.
 */
@Service()
export class BusinessContext {
  private readonly auth = inject(AuthStore);
  private readonly config = inject(ConfigService);
  private readonly store = inject(LocalStore);

  private readonly selectedId = signal<string | null>(this.store.get<string>(SELECTED_KEY));

  /** Lista de negocios (solo se pide para superadmin). */
  readonly businesses = httpResource<Page<Business>>(
    () =>
      this.auth.isSuperadmin()
        ? { url: this.config.api('/businesses'), params: { limit: 100 } }
        : undefined,
    { parse: (body) => toPage<Business>(body) },
  );

  readonly options = computed(() =>
    this.businesses.hasValue() ? this.businesses.value().items : [],
  );

  /** id que debe viajar en `x-business-id` (null = ninguno seleccionado). */
  readonly headerBusinessId = computed(() => (this.auth.isSuperadmin() ? this.selectedId() : null));

  readonly current = computed<Business | null>(() => {
    if (!this.auth.isSuperadmin()) return this.auth.business();
    const id = this.selectedId();
    return this.options().find((b) => b.id === id) ?? null;
  });

  /**
   * Negocio en el que operan las pantallas de catálogo, almacén, ventas…
   * `null` si el superadmin no ha elegido uno. Léelo dentro de un `httpResource` para
   * (a) no pedir datos sin negocio y (b) recargar al cambiar de negocio:
   *   httpResource(() => this.context.scope() ? { url, params } : undefined)
   */
  readonly scope = computed<string | null>(() =>
    this.auth.isSuperadmin() ? this.selectedId() : (this.auth.business()?.id ?? null),
  );

  constructor() {
    // Si el negocio guardado ya no existe en la lista, se limpia la selección.
    effect(() => {
      const id = this.selectedId();
      if (id && this.businesses.hasValue() && !this.options().some((b) => b.id === id)) {
        this.select(null);
      }
    });
  }

  select(id: string | null): void {
    this.selectedId.set(id);
    if (id) this.store.set(SELECTED_KEY, id);
    else this.store.remove(SELECTED_KEY);
  }

  nameOf(id: string | null): string {
    if (!id) return '—';
    return this.options().find((b) => b.id === id)?.name ?? '—';
  }
}
