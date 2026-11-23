import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  type TemplateRef,
  computed,
  contentChildren,
  input,
  model,
  output,
} from '@angular/core';
import { formatDate, formatDateTime, formatMoney, formatQty } from '../../utils/format';
import { PosEmptyState } from '../empty-state/empty-state';
import { PosIcon } from '../icon/icon';
import type { IconName } from '../icon/icons';
import { PosPaginator } from '../paginator/paginator';
import { type PosCellContext, PosCellDef } from './cell-def';
import type { PageInfo, TableColumn, TableSort } from './table.types';

const SKELETON_ROWS = [0, 1, 2, 3, 4];
const numberFormatter = new Intl.NumberFormat('es-MX');

/**
 * Tabla reutilizable del sistema.
 *   <pos-table [columns]="columns" [rows]="users()" [loading]="loading()"
 *              [page]="meta()" (pageChange)="goTo($event)" caption="Usuarios">
 *     <ng-template posCell="actions" [posCellOf]="users()" let-user>…</ng-template>
 *   </pos-table>
 * - `sortMode="client"` ordena la página actual; `"server"` solo actualiza `sort` (escucha `sortChange`).
 */
@Component({
  selector: 'pos-table',
  imports: [NgTemplateOutlet, PosIcon, PosEmptyState, PosPaginator],
  templateUrl: './table.html',
  styleUrl: './table.scss',
})
export class PosTable<T> {
  readonly columns = input.required<readonly TableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  readonly loading = input(false);
  /** Texto accesible que describe la tabla. */
  readonly caption = input.required<string>();
  readonly rowKey = input<(row: T, index: number) => unknown>((row, index) => {
    const id = (row as { id?: unknown }).id;
    return id ?? index;
  });
  readonly sort = model<TableSort | undefined>(undefined);
  readonly sortMode = input<'client' | 'server'>('client');
  readonly page = input<PageInfo>();

  readonly emptyTitle = input('Sin registros');
  readonly emptyMessage = input('');
  readonly emptyIcon = input<IconName>('inbox');

  /** `sort` es un model(): escucha `(sortChange)` o usa `[(sort)]`. */
  readonly pageChange = output<number>();

  private readonly cellDefs = contentChildren(PosCellDef);

  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly templates = computed(() => {
    const map = new Map<string, TemplateRef<PosCellContext<T>>>();
    for (const def of this.cellDefs()) {
      map.set(def.posCell(), def.template as TemplateRef<PosCellContext<T>>);
    }
    return map;
  });

  protected readonly visibleRows = computed(() => {
    const rows = this.rows();
    const sort = this.sort();
    if (!sort || this.sortMode() === 'server') return rows;
    const column = this.columns().find((c) => c.key === sort.key);
    if (!column) return rows;

    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) => compare(this.rawValue(column, a), this.rawValue(column, b)) * factor,
    );
  });

  protected toggleSort(column: TableColumn<T>): void {
    if (!column.sortable) return;
    const current = this.sort();
    const direction = current?.key === column.key && current.direction === 'asc' ? 'desc' : 'asc';
    this.sort.set({ key: column.key, direction });
  }

  protected ariaSort(column: TableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable) return null;
    const sort = this.sort();
    if (sort?.key !== column.key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(column: TableColumn<T>): IconName {
    const sort = this.sort();
    if (sort?.key !== column.key) return 'chevrons-up-down';
    return sort.direction === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  protected align(column: TableColumn<T>): 'start' | 'center' | 'end' {
    if (column.align) return column.align;
    return column.type === 'money' || column.type === 'qty' || column.type === 'number'
      ? 'end'
      : 'start';
  }

  protected display(column: TableColumn<T>, row: T): string {
    const value = this.rawValue(column, row);
    switch (column.type) {
      case 'money':
        return formatMoney(value as number);
      case 'qty':
        return column.unit ? formatQty(value as number, column.unit(row)) : String(value ?? '—');
      case 'number':
        return typeof value === 'number' ? numberFormatter.format(value) : '—';
      case 'date':
        return formatDate(value as string);
      case 'datetime':
        return formatDateTime(value as string);
      default:
        return value == null || value === '' ? '—' : String(value);
    }
  }

  private rawValue(column: TableColumn<T>, row: T): unknown {
    return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
  }
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es-MX', { sensitivity: 'base', numeric: true });
}
