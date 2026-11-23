import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type Page, toApiError, toPage } from '../../../core/api/api-types';
import { AuthStore } from '../../../core/auth/auth-store';
import { BusinessContext } from '../../../core/business/business-context';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import {
  DialogService,
  PosBadge,
  PosBusinessGate,
  PosButton,
  PosCard,
  PosCellDef,
  PosEmptyState,
  PosInput,
  PosPageHeader,
  PosSelect,
  PosSpinner,
  PosStatTile,
  PosTable,
  type SelectOption,
  type TableColumn,
  ToastService,
} from '../../../shared/ui';
import { formatDateTime, formatMoney } from '../../../shared/utils/format';
import { cleanParams } from '../../catalog/catalog-api';
import { CashSessionStore } from '../cash-session-store';
import { PosApi } from '../pos-api';
import { type CashSession, cashDifference, sessionFolio, sessionTotals } from '../pos-models';
import { PosCashBreakdown } from './cash-breakdown';
import { CashMovementDialog, type CashMovementDialogData } from './cash-movement-dialog';
import { PosCashMovements } from './cash-movements';
import { CloseSessionDialog } from './close-session-dialog';
import { type SessionDetailData, SessionDetailDialog } from './session-detail-dialog';

@Component({
  selector: 'pos-cash-page',
  imports: [
    RouterLink,
    MoneyPipe,
    PosBadge,
    PosBusinessGate,
    PosButton,
    PosCard,
    PosCellDef,
    PosEmptyState,
    PosInput,
    PosPageHeader,
    PosSelect,
    PosSpinner,
    PosStatTile,
    PosTable,
    PosCashBreakdown,
    PosCashMovements,
  ],
  templateUrl: './cash-page.html',
  styleUrl: './cash-page.scss',
})
export class CashPage {
  private readonly api = inject(PosApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(CashSessionStore);
  protected readonly context = inject(BusinessContext);

  protected readonly isManager = computed(() => this.auth.hasRole('admin', 'superadmin'));
  protected readonly when = formatDateTime;
  protected readonly folioOf = (s: CashSession) => sessionFolio(s.folio);

  /** Indicadores del turno abierto. */
  protected readonly tiles = computed(() => {
    const session = this.store.current();
    if (!session) return null;
    const t = sessionTotals(session);
    return {
      expected: formatMoney(t.expectedCashCents),
      sold: formatMoney(t.salesTotalCents),
      tickets: `${t.salesCount} ${t.salesCount === 1 ? 'ticket' : 'tickets'}`,
      float: formatMoney(session.openingFloatCents),
      flows: `+${formatMoney(t.cashInCents)} / −${formatMoney(t.cashOutCents)}`,
      cashOnHand: t.expectedCashCents,
    };
  });

  // ---- Historial de turnos ----
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly status = signal('');
  protected readonly page = linkedSignal({
    source: () => [this.from(), this.to(), this.status(), this.context.scope()],
    computation: () => 1,
  });
  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todos' },
    { value: 'open', label: 'Abiertos' },
    { value: 'closed', label: 'Cerrados' },
  ];

  protected readonly history = httpResource<Page<CashSession>>(
    () =>
      this.context.scope()
        ? {
            url: this.api.sessionsUrl,
            params: cleanParams({
              page: this.page(),
              limit: 15,
              from: this.from(),
              to: this.to(),
              status: this.status(),
            }),
          }
        : undefined,
    { parse: (body) => toPage<CashSession>(body) },
  );
  protected readonly rows = computed(() =>
    this.history.hasValue() ? this.history.value().items : [],
  );
  protected readonly meta = computed(() =>
    this.history.hasValue() ? this.history.value().meta : undefined,
  );

  /** En turnos abiertos los totales aún no se congelan: se muestran como "—". */
  private readonly closedOnly =
    (pick: (s: CashSession) => number | null) =>
    (s: CashSession): number | null =>
      s.status === 'closed' ? pick(s) : null;

  protected readonly columns = computed<TableColumn<CashSession>[]>(() => [
    { key: 'folio', header: 'Turno', width: '8rem' },
    ...(this.isManager()
      ? [{ key: 'userName', header: 'Cajero' } as TableColumn<CashSession>]
      : []),
    { key: 'openedAt', header: 'Apertura', type: 'datetime', width: '11rem', hideOnMobile: true },
    { key: 'closedAt', header: 'Corte', type: 'datetime', width: '11rem', hideOnMobile: true },
    {
      key: 'salesTotalCents',
      header: 'Vendido',
      type: 'money',
      hideOnMobile: true,
      value: this.closedOnly((s) => s.salesTotalCents),
    },
    {
      key: 'expectedCashCents',
      header: 'Esperado',
      type: 'money',
      hideOnMobile: true,
      value: this.closedOnly((s) => s.expectedCashCents),
    },
    {
      key: 'countedCashCents',
      header: 'Contado',
      type: 'money',
      value: this.closedOnly((s) => s.countedCashCents),
    },
    { key: 'differenceCents', header: 'Diferencia', align: 'end', width: '10rem' },
    { key: 'actions', header: '', align: 'end', width: '4rem' },
  ]);

  protected readonly differenceOf = (s: CashSession) =>
    s.differenceCents === null ? null : cashDifference(s.differenceCents);

  constructor() {
    // Totales frescos al entrar (las ventas se registran en otra pantalla).
    this.store.reload();
    effect(() => {
      const error = this.history.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  protected refresh(): void {
    this.store.reload();
    this.history.reload();
  }

  protected movement(type: 'in' | 'out'): void {
    const tiles = this.tiles();
    if (!tiles) return;
    this.dialogs
      .open<CashSession, CashMovementDialogData>(CashMovementDialog, {
        data: { type, cashOnHandCents: tiles.cashOnHand },
        size: 'sm',
      })
      .closed.subscribe((session) => {
        if (session) this.history.reload();
      });
  }

  protected closeTurn(session: CashSession): void {
    this.dialogs
      .open<CashSession, CashSession>(CloseSessionDialog, { data: session, size: 'sm' })
      .closed.subscribe((closed) => {
        this.history.reload();
        if (closed) this.open(closed);
      });
  }

  protected open(session: CashSession): void {
    this.dialogs.open<void, SessionDetailData>(SessionDetailDialog, {
      data: { id: session.id, folio: session.folio },
      size: 'sm',
      autoFocus: 'first-tabbable',
    });
  }
}
