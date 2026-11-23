import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { type Page, toApiError, toPage } from '../../core/api/api-types';
import { ROLE_LABELS, type Role, type User } from '../../core/auth/auth-models';
import { AuthStore } from '../../core/auth/auth-store';
import { BusinessContext } from '../../core/business/business-context';
import {
  type BadgeTone,
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
import { UserApi } from './user-api';
import { type UserFormData, UserFormDialog } from './user-form-dialog';

const PAGE_SIZE = 20;

const ROLE_TONE: Record<Role, BadgeTone> = {
  superadmin: 'warning',
  admin: 'brand',
  employee: 'neutral',
};

@Component({
  selector: 'pos-users-page',
  imports: [PosPageHeader, PosButton, PosInput, PosSelect, PosTable, PosCellDef, PosBadge],
  templateUrl: './users-page.html',
})
export class UsersPage {
  private readonly api = inject(UserApi);
  private readonly dialogs = inject(DialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);
  protected readonly context = inject(BusinessContext);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly roleTone = ROLE_TONE;

  protected readonly searchText = signal('');
  protected readonly role = signal('');
  protected readonly status = signal('');
  /** Filtro de negocio del superadmin; arranca con el negocio activo de la barra superior. */
  protected readonly businessFilter = linkedSignal(() => this.context.current()?.id ?? '');
  private readonly search = debounced(this.searchText);
  protected readonly page = linkedSignal({
    source: () => [this.search(), this.role(), this.status(), this.businessFilter()],
    computation: () => 1,
  });

  protected readonly roleOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todos' },
    ...(this.auth.isSuperadmin() ? [{ value: 'superadmin', label: ROLE_LABELS.superadmin }] : []),
    { value: 'admin', label: ROLE_LABELS.admin },
    { value: 'employee', label: ROLE_LABELS.employee },
  ]);
  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todos' },
    { value: 'true', label: 'Activos' },
    { value: 'false', label: 'Inactivos' },
  ];
  protected readonly businessOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todos' },
    ...this.context.options().map((b) => ({ value: b.id, label: b.name })),
  ]);

  protected readonly users = httpResource<Page<User>>(
    () => ({
      url: this.api.url,
      params: this.api.listParams({
        page: this.page(),
        limit: PAGE_SIZE,
        search: this.search().trim() || undefined,
        role: this.role() || undefined,
        active: this.status() === '' ? undefined : this.status() === 'true',
        businessId: this.auth.isSuperadmin() ? this.businessFilter() || undefined : undefined,
      }),
    }),
    { parse: (body) => toPage<User>(body) },
  );

  protected readonly rows = computed(() => (this.users.hasValue() ? this.users.value().items : []));
  protected readonly meta = computed(() =>
    this.users.hasValue() ? this.users.value().meta : undefined,
  );

  protected readonly columns = computed<TableColumn<User>[]>(() => [
    { key: 'name', header: 'Usuario', sortable: true },
    { key: 'role', header: 'Rol', width: '11rem' },
    ...(this.auth.isSuperadmin()
      ? [
          {
            key: 'business',
            header: 'Negocio',
            hideOnMobile: true,
            value: (u: User) => this.context.nameOf(u.businessId),
          },
        ]
      : []),
    { key: 'lastLoginAt', header: 'Último acceso', type: 'datetime', hideOnMobile: true },
    { key: 'status', header: 'Estado', width: '8rem' },
    { key: 'actions', header: '', align: 'end', width: '6.5rem' },
  ]);

  constructor() {
    effect(() => {
      const error = this.users.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  /** El admin solo administra empleados; nadie se desactiva a sí mismo. */
  protected canManage(user: User): boolean {
    return this.auth.isSuperadmin() || user.role === 'employee';
  }

  protected isSelf(user: User): boolean {
    return user.id === this.auth.user()?.id;
  }

  protected openForm(user?: User): void {
    const ref = this.dialogs.open<User, UserFormData>(UserFormDialog, { data: { user } });
    ref.closed.subscribe((saved) => {
      if (saved) this.users.reload();
    });
  }

  protected async toggleActive(user: User): Promise<void> {
    if (user.active) {
      const ok = await this.confirm.ask({
        heading: '¿Desactivar usuario?',
        message: `${user.name} ya no podrá iniciar sesión. Su historial de ventas se conserva.`,
        confirmText: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await this.api.update(user.id, { active: !user.active });
      this.toast.success(user.active ? 'Usuario desactivado' : 'Usuario reactivado');
      this.users.reload();
    } catch (error) {
      this.toast.error(toApiError(error).message);
    }
  }
}
