import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { unwrap } from '../../core/api/api-types';
import { ConfigService } from '../../core/config/config-service';
import type { CashSession, PaymentMethod, Sale } from './pos-models';

export interface SaleInput {
  items: { productId: string; qtyBase: number; weighed?: boolean }[];
  payments: { method: PaymentMethod; amountCents: number }[];
  cashReceivedCents?: number;
  expectedTotalCents: number;
}

/** Caja: catálogo, turnos y ventas. */
@Service()
export class PosApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  readonly catalogUrl = this.config.api('/pos/catalog');
  readonly sessionsUrl = this.config.api('/cash-sessions');
  readonly currentSessionUrl = this.config.api('/cash-sessions/current');
  readonly salesUrl = this.config.api('/sales');

  async openSession(openingFloatCents: number): Promise<CashSession> {
    return unwrap(
      await firstValueFrom(this.http.post(`${this.sessionsUrl}/open`, { openingFloatCents })),
    );
  }

  async addCashMovement(input: {
    type: 'in' | 'out';
    amountCents: number;
    reason: string;
  }): Promise<CashSession> {
    return unwrap(
      await firstValueFrom(this.http.post(`${this.currentSessionUrl}/movements`, input)),
    );
  }

  async closeSession(countedCashCents: number, notes?: string): Promise<CashSession> {
    return unwrap(
      await firstValueFrom(
        this.http.post(`${this.currentSessionUrl}/close`, { countedCashCents, notes }),
      ),
    );
  }

  async getSession(id: string): Promise<CashSession> {
    return unwrap(await firstValueFrom(this.http.get(`${this.sessionsUrl}/${id}`)));
  }

  async createSale(input: SaleInput): Promise<Sale> {
    return unwrap(await firstValueFrom(this.http.post(this.salesUrl, input)));
  }

  async getSale(id: string): Promise<Sale> {
    return unwrap(await firstValueFrom(this.http.get(`${this.salesUrl}/${id}`)));
  }

  async cancelSale(id: string, reason: string): Promise<Sale> {
    return unwrap(
      await firstValueFrom(this.http.post(`${this.salesUrl}/${id}/cancel`, { reason })),
    );
  }
}
