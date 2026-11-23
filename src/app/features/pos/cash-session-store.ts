import { httpResource } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { unwrap } from '../../core/api/api-types';
import { BusinessContext } from '../../core/business/business-context';
import { PosApi } from './pos-api';
import type { CashSession } from './pos-models';

/** Turno de caja abierto del usuario actual (o null). Lo usan la caja, el corte y la barra superior. */
@Service()
export class CashSessionStore {
  private readonly api = inject(PosApi);
  private readonly context = inject(BusinessContext);

  readonly resource = httpResource<CashSession | null>(
    () => (this.context.scope() ? this.api.currentSessionUrl : undefined),
    { parse: (body) => unwrap<CashSession | null>(body) },
  );

  /** undefined = cargando; null = caja cerrada. */
  readonly current = computed<CashSession | null | undefined>(() => {
    if (this.resource.error()) return null;
    return this.resource.hasValue() ? this.resource.value() : undefined;
  });
  readonly isOpen = computed(() => Boolean(this.current()));

  async open(openingFloatCents: number): Promise<CashSession> {
    const session = await this.api.openSession(openingFloatCents);
    this.resource.set(session);
    return session;
  }

  async addMovement(input: {
    type: 'in' | 'out';
    amountCents: number;
    reason: string;
  }): Promise<CashSession> {
    const session = await this.api.addCashMovement(input);
    this.resource.set(session);
    return session;
  }

  /** Corte de caja: devuelve el turno cerrado y deja la caja cerrada. */
  async close(countedCashCents: number, notes?: string): Promise<CashSession> {
    const session = await this.api.closeSession(countedCashCents, notes);
    this.resource.set(null);
    return session;
  }

  set(session: CashSession | null): void {
    this.resource.set(session);
  }

  reload(): void {
    this.resource.reload();
  }
}
