import type { Unit } from '../../utils/qty';

export type ColumnType = 'text' | 'number' | 'money' | 'qty' | 'date' | 'datetime';
export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  key: string;
  direction: SortDirection;
}

export interface TableColumn<T> {
  /** Identificador de la columna; también es la propiedad que se lee si no hay `value`. */
  key: string;
  header: string;
  /** Formato de la celda. `money` espera centavos; `qty` espera unidad base + `unit`. */
  type?: ColumnType;
  value?: (row: T) => unknown;
  /** Unidad para columnas `qty`. */
  unit?: (row: T) => Unit;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
  /** Ancho CSS opcional, p. ej. '8rem'. */
  width?: string;
  /** Oculta la columna en pantallas angostas. */
  hideOnMobile?: boolean;
}

export interface PageInfo {
  page: number;
  pages: number;
  total: number;
  limit: number;
}
