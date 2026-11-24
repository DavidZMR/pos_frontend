import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { unwrap } from '../../core/api/api-types';
import { ConfigService } from '../../core/config/config-service';

export type ReportPath =
  | 'summary'
  | 'sales-series'
  | 'top-products'
  | 'categories'
  | 'payments'
  | 'purchases'
  | 'businesses';

/** `/api/v1/reports/*` (lectura). Las vistas usan `url()` con httpResource; la exportación, `get()`. */
@Service()
export class ReportsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  url(path: ReportPath): string {
    return this.config.api(`/reports/${path}`);
  }

  async get<T>(path: ReportPath, params: object): Promise<T> {
    return unwrap<T>(
      await firstValueFrom(
        this.http.get(this.url(path), { params: params as Record<string, string | number> }),
      ),
    );
  }
}
