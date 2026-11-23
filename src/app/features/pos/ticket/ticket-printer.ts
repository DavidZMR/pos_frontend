import { Service, computed, inject } from '@angular/core';
import { BRAND } from '../../../core/branding';
import { CurrentBusiness } from '../../../core/business/current-business';
import { PrinterStore } from '../../../core/hardware/printer-store';
import { ToastService } from '../../../shared/ui';
import type { CashSession, Sale } from '../pos-models';
import {
  type TicketBusiness,
  type TicketOptions,
  cashCloseHtml,
  saleTicketHtml,
} from './ticket-html';

/**
 * Imprime tickets de venta y de corte en la impresora de esta PC. Si no hay impresora
 * configurada e instalada, `ready` es false y las pantallas no ofrecen imprimir.
 */
@Service()
export class TicketPrinter {
  private readonly printer = inject(PrinterStore);
  private readonly business = inject(CurrentBusiness);
  private readonly toast = inject(ToastService);

  readonly ready = this.printer.ready;
  /** Imprimir solo al terminar cada venta. */
  readonly autoPrint = computed(() => this.printer.ready() && this.printer.config().autoPrint);

  printSale(sale: Sale, { reprint = false } = {}): Promise<boolean> {
    return this.send(
      (business, options) =>
        saleTicketHtml(sale, business, { ...options, copyLabel: reprint ? 'REIMPRESIÓN' : '' }),
      'Ticket impreso',
    );
  }

  printCashClose(session: CashSession): Promise<boolean> {
    return this.send(
      (business, options) => cashCloseHtml(session, business, options),
      'Corte impreso',
    );
  }

  /** Ticket de prueba con los datos reales del negocio (pantalla Equipo). */
  printSample(sale: Sale): Promise<boolean> {
    return this.send(
      (business, options) => saleTicketHtml(sale, business, { ...options, copyLabel: 'PRUEBA' }),
      'Ticket de prueba impreso',
    );
  }

  private async send(
    build: (business: TicketBusiness, options: TicketOptions) => string,
    success: string,
  ): Promise<boolean> {
    const business: TicketBusiness = (await this.business.get()) ?? {
      name: BRAND.name,
      ticket: { header: '', footer: '' },
    };
    const html = build(business, { widthMm: this.printer.config().widthMm });
    const result = await this.printer.print(html);
    if (result.ok) this.toast.success(success);
    else this.toast.error(`No se pudo imprimir: ${result.error}`);
    return result.ok;
  }
}
