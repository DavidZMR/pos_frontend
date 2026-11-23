import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { type Page, toApiError, toPage } from '../../core/api/api-types';
import type { Business } from '../../core/auth/auth-models';
import { BusinessContext } from '../../core/business/business-context';
import {
  ConfirmService,
  DialogService,
  PosBadge,
  PosButton,
  PosCellDef,
  PosInput,
  PosPageHeader,
  PosSelect,
  PosTable,
  type SelectOption,
  type TableColumn,
  ToastService,
} from '../../shared/ui';
import { debounced } from '../../shared/utils/debounced';
import { BusinessApi } from './business-api';
import { type BusinessFormData, BusinessFormDialog } from './business-form-dialog';

const PAGE_SIZE = 20;

@Component({
  selector: 'pos-businesses-page',
  imports: [PosPageHeader, PosButton, PosInput, PosSelect, PosTable, PosCellDef, PosBadge],
  templateUrl: './businesses-page.html',
})
export class BusinessesPage {
  private readonly api = inject(BusinessApi);
  private readonly dialogs = inject(DialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly context = inject(BusinessContext);

  protected readonly searchText = signal('');
  protected readonly status = signal('');
  private readonly search = debounced(this.searchText);
  /** Vuelve a la página 1 cuando cambian los filtros. */
  protected readonly page = linkedSignal({
    source: () => [this.search(), this.status()],
    computation: () => 1,
  });

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todos' },
    { value: 'true', label: 'Activos' },
    { value: 'false', label: 'Inactivos' },
  ];

  protected readonly businesses = httpResource<Page<Business>>(
    () => ({
      url: this.api.url,
      params: this.api.listParams({
        page: this.page(),
        limit: PAGE_SIZE,
        search: this.search().trim() || undefined,
        active: this.status() === '' ? undefined : this.status() === 'true',
      }),
    }),
    { parse: (body) => toPage<Business>(body) },
  );

  protected readonly rows = computed(() =>
    this.businesses.hasValue() ? this.businesses.value().items : [],
  );
  protected readonly meta = computed(() =>
    this.businesses.hasValue() ? this.businesses.value().meta : undefined,
  );

  protected readonly columns: TableColumn<Business>[] = [
    { key: 'name', header: 'Negocio' },
    { key: 'phone', header: 'Teléfono', hideOnMobile: true },
    { key: 'createdAt', header: 'Alta', type: 'date', hideOnMobile: true, width: '9rem' },
    { key: 'status', header: 'Estado', width: '8rem' },
    { key: 'actions', header: '', align: 'end', width: '6.5rem' },
  ];

  constructor() {
    effect(() => {
      const error = this.businesses.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  protected openForm(business?: Business): void {
    const ref = this.dialogs.open<Business, BusinessFormData>(BusinessFormDialog, {
      data: { business },
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.refresh();
    });
  }

  protected async toggleActive(business: Business): Promise<void> {
    if (business.active) {
      const ok = await this.confirm.ask({
        heading: '¿Desactivar negocio?',
        message: `Nadie de "${business.name}" podrá iniciar sesión hasta que lo reactives. Sus datos se conservan.`,
        confirmText: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await this.api.update(business.id, { active: !business.active });
      this.toast.success(business.active ? 'Negocio desactivado' : 'Negocio reactivado');
      this.refresh();
    } catch (error) {
      this.toast.error(toApiError(error).message);
    }
  }

  private refresh(): void {
    this.businesses.reload();
    this.context.businesses.reload();
  }
}
