import { HttpErrorResponse } from '@angular/common/http';
import type { PageInfo } from '../../shared/ui/table/table.types';

/** Sobre de respuesta exitosa del backend. */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ApiFailureBody {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | unknown;
  };
}

export interface Page<T> {
  items: T[];
  meta: PageInfo;
}

/** Extrae `data` del sobre. Úsalo como `parse` de httpResource o tras firstValueFrom. */
export function unwrap<T>(body: unknown): T {
  return (body as ApiSuccess<T>).data;
}

/** Convierte una respuesta paginada `{ data: T[], meta }` en `Page<T>`. */
export function toPage<T>(body: unknown): Page<T> {
  const response = body as ApiSuccess<T[]>;
  const meta = response.meta as Partial<PageInfo> | undefined;
  return {
    items: response.data,
    meta: {
      page: meta?.page ?? 1,
      pages: meta?.pages ?? 1,
      total: meta?.total ?? response.data.length,
      limit: meta?.limit ?? response.data.length,
    },
  };
}

/** Error del API normalizado para la UI. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return new ApiError(0, 'NETWORK', 'No hay conexión con el servidor. Revisa tu red.');
    }
    const body = error.error as ApiFailureBody | null;
    const details = body?.error?.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return new ApiError(
      error.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? 'Ocurrió un error inesperado.',
      details?.fieldErrors ?? {},
    );
  }
  return new ApiError(-1, 'UNKNOWN', 'Ocurrió un error inesperado.');
}
