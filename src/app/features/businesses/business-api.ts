import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { unwrap } from '../../core/api/api-types';
import type { Business } from '../../core/auth/auth-models';
import { ConfigService } from '../../core/config/config-service';

export interface BusinessInput {
  name: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  address?: string;
  timezone?: string;
  settings?: { allowNegativeStock?: boolean };
  active?: boolean;
}

export interface BusinessListParams {
  page: number;
  limit: number;
  search?: string;
  active?: boolean;
}

/** Zonas horarias de México para el negocio (afectan cortes y reportes por día). */
export const MX_TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Centro (CDMX, Guadalajara, Monterrey)' },
  { value: 'America/Cancun', label: 'Sureste (Quintana Roo)' },
  { value: 'America/Mazatlan', label: 'Pacífico (Sinaloa, Nayarit, BCS)' },
  { value: 'America/Hermosillo', label: 'Sonora' },
  { value: 'America/Tijuana', label: 'Noroeste (Baja California)' },
] as const;

@Service()
export class BusinessApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  readonly url = this.config.api('/businesses');

  listParams({ page, limit, search, active }: BusinessListParams): Record<string, string | number> {
    const params: Record<string, string | number> = { page, limit };
    if (search) params['search'] = search;
    if (active !== undefined) params['active'] = String(active);
    return params;
  }

  async create(input: BusinessInput): Promise<Business> {
    return unwrap<Business>(await firstValueFrom(this.http.post(this.url, input)));
  }

  async update(id: string, input: Partial<BusinessInput>): Promise<Business> {
    return unwrap<Business>(await firstValueFrom(this.http.patch(`${this.url}/${id}`, input)));
  }
}
