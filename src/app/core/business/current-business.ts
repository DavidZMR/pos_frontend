import { HttpClient, httpResource } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { unwrap } from '../api/api-types';
import type { Business } from '../auth/auth-models';
import { ConfigService } from '../config/config-service';
import { BusinessContext } from './business-context';

export interface TicketDataInput {
  name: string;
  legalName: string;
  taxId: string;
  phone: string;
  address: string;
  ticket: { header: string; footer: string };
}

/**
 * Datos frescos del negocio en el que se trabaja (para tickets): `GET /businesses/current`.
 * La copia de la sesión puede estar desactualizada si el admin cambió el encabezado del ticket.
 */
@Service()
export class CurrentBusiness {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly context = inject(BusinessContext);
  private readonly url = this.config.api('/businesses/current');

  readonly resource = httpResource<Business>(() => (this.context.scope() ? this.url : undefined), {
    parse: (body) => unwrap<Business>(body),
  });

  /** El negocio actual (respaldo: el de la sesión mientras carga). */
  readonly value = computed<Business | null>(() =>
    this.resource.hasValue() ? this.resource.value() : this.context.current(),
  );

  /** Espera los datos del negocio (para imprimir justo después de cobrar). */
  async get(): Promise<Business | null> {
    if (this.resource.hasValue()) return this.resource.value();
    if (!this.context.scope()) return null;
    try {
      return unwrap<Business>(await firstValueFrom(this.http.get(this.url)));
    } catch {
      return this.context.current();
    }
  }

  /** Datos que aparecen en el ticket (admin). Vacío = se borra. */
  async updateTicketData(input: TicketDataInput): Promise<Business> {
    const business = unwrap<Business>(await firstValueFrom(this.http.patch(this.url, input)));
    this.resource.set(business);
    return business;
  }
}
