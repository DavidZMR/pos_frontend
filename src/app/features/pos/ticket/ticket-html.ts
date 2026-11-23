import type { Business } from '../../../core/auth/auth-models';
import { formatDateTime, formatMoney, formatQty } from '../../../shared/utils/format';
import {
  type CashSession,
  PAYMENT_LABEL,
  PAYMENT_METHODS,
  type Sale,
  cashDifference,
  saleFolio,
  sessionFolio,
  sessionTotals,
} from '../pos-models';

/**
 * Tickets impresos (documentos HTML completos, en negro, para térmicas de 58/80 mm).
 * Funciones puras: todo texto que venga de datos se escapa.
 */

export type PaperWidth = 58 | 80;

export type TicketBusiness = Pick<
  Business,
  'name' | 'legalName' | 'taxId' | 'phone' | 'address' | 'ticket'
>;

export interface TicketOptions {
  widthMm: PaperWidth;
  /** Leyenda arriba del ticket, p. ej. "Reimpresión". */
  copyLabel?: string;
  /** Momento de impresión (para pruebas). */
  printedAt?: Date;
}

const DEFAULT_FOOTER = '¡Gracias por su compra!';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Ticket de una venta (o su reimpresión). */
export function saleTicketHtml(
  sale: Sale,
  business: TicketBusiness,
  options: TicketOptions,
): string {
  const items = sale.items
    .map(
      (item) => `
      <div class="item">
        <div class="item-name">${escapeHtml(item.name)}</div>
        ${row(`${escapeHtml(formatQty(item.qtyBase, item.unit))} × ${escapeHtml(formatMoney(item.unitPriceCents))}`, formatMoney(item.lineTotalCents), 'calc')}
      </div>`,
    )
    .join('');
  const payments = sale.payments
    .map((p) => row(escapeHtml(PAYMENT_LABEL[p.method].label), formatMoney(p.amountCents)))
    .join('');
  const change =
    sale.changeCents > 0
      ? row('Recibido', formatMoney(sale.cashReceivedCents)) +
        row('Cambio', formatMoney(sale.changeCents), 'b')
      : '';
  const pieces = sale.items.length === 1 ? '1 renglón' : `${sale.items.length} renglones`;

  const body = `
    ${header(business, options)}
    <div class="sep"></div>
    ${row('Folio', saleFolio(sale.folio), 'b')}
    ${row('Fecha', formatDateTime(sale.createdAt))}
    ${row('Atendió', sale.cashierName)}
    ${sale.status === 'cancelled' ? `<div class="stamp">VENTA CANCELADA</div>` : ''}
    <div class="sep"></div>
    ${items}
    <div class="sep"></div>
    ${row('TOTAL', formatMoney(sale.totalCents), 'total')}
    ${row('IVA incluido', formatMoney(sale.taxCents), 'small')}
    <div class="gap"></div>
    ${payments}
    ${change}
    <div class="small c">${pieces}</div>
    <div class="sep"></div>
    <div class="c pre">${escapeHtml(business.ticket?.footer?.trim() || DEFAULT_FOOTER)}</div>
  `;
  return documentHtml(`Venta ${saleFolio(sale.folio)}`, body, options);
}

/** Comprobante del corte de caja (o del turno abierto, como corte parcial). */
export function cashCloseHtml(
  session: CashSession,
  business: TicketBusiness,
  options: TicketOptions,
): string {
  const t = sessionTotals(session);
  const closed = session.status === 'closed';
  const diff = session.differenceCents === null ? null : cashDifference(session.differenceCents);
  const methods = PAYMENT_METHODS.map((m) =>
    row(escapeHtml(PAYMENT_LABEL[m].label), formatMoney(t.byMethod[m])),
  ).join('');
  const movements = session.movements.length
    ? session.movements
        .map((m) =>
          row(
            `${m.type === 'in' ? 'Entrada' : 'Retiro'}: ${escapeHtml(m.reason)}`,
            `${m.type === 'in' ? '+' : '−'}${formatMoney(m.amountCents)}`,
            'small',
          ),
        )
        .join('')
    : `<div class="small">Sin entradas ni retiros</div>`;

  const body = `
    ${header(business, options)}
    <div class="sep"></div>
    <div class="c title">${closed ? 'CORTE DE CAJA' : 'CORTE PARCIAL (TURNO ABIERTO)'}</div>
    ${row('Turno', sessionFolio(session.folio), 'b')}
    ${row('Cajero', session.userName)}
    ${row('Apertura', formatDateTime(session.openedAt))}
    ${closed ? row('Corte', formatDateTime(session.closedAt)) : ''}
    <div class="sep"></div>
    ${row('Fondo inicial', formatMoney(session.openingFloatCents))}
    ${row('Ventas en efectivo', `+${formatMoney(t.byMethod.cash)}`)}
    ${row('Entradas', `+${formatMoney(t.cashInCents)}`)}
    ${row('Retiros', `−${formatMoney(t.cashOutCents)}`)}
    ${row('Efectivo esperado', formatMoney(t.expectedCashCents), 'b')}
    ${
      closed && session.countedCashCents !== null
        ? row('Efectivo contado', formatMoney(session.countedCashCents), 'b') +
          (diff ? row(`Diferencia (${diff.label})`, formatMoney(session.differenceCents), 'b') : '')
        : ''
    }
    <div class="sep"></div>
    <div class="b">Ventas del turno</div>
    ${methods}
    ${row('Total vendido', formatMoney(t.salesTotalCents), 'total')}
    ${row('Tickets', String(t.salesCount), 'small')}
    ${t.cancelledCount ? row('Cancelados', String(t.cancelledCount), 'small') : ''}
    <div class="sep"></div>
    <div class="b">Entradas y retiros</div>
    ${movements}
    ${session.notes ? `<div class="sep"></div><div class="pre small">${escapeHtml(session.notes)}</div>` : ''}
    <div class="signatures">
      <div><div class="line"></div>Entregó</div>
      <div><div class="line"></div>Recibió</div>
    </div>
  `;
  return documentHtml(`Corte ${sessionFolio(session.folio)}`, body, options);
}

function header(business: TicketBusiness, options: TicketOptions): string {
  const lines = [
    business.legalName,
    business.taxId ? `RFC: ${business.taxId}` : '',
    business.address,
    business.phone ? `Tel. ${business.phone}` : '',
  ].filter((line) => line?.trim());
  return `
    ${options.copyLabel ? `<div class="copy">${escapeHtml(options.copyLabel)}</div>` : ''}
    <div class="c name">${escapeHtml(business.name)}</div>
    ${lines.map((line) => `<div class="c small">${escapeHtml(line)}</div>`).join('')}
    ${business.ticket?.header?.trim() ? `<div class="c pre gap-top">${escapeHtml(business.ticket.header.trim())}</div>` : ''}
  `;
}

/** `label` es HTML (quien llama escapa lo que venga de datos); `value` es texto y se escapa aquí. */
function row(label: string, value: string, className = ''): string {
  return `<div class="row ${className}"><span>${label}</span><span>${escapeHtml(value)}</span></div>`;
}

function documentHtml(title: string, body: string, options: TicketOptions): string {
  const narrow = options.widthMm === 58;
  const printed = formatDateTime(options.printedAt ?? new Date());
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: ${options.widthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${options.widthMm}mm; background: #fff; color: #000; }
  body {
    padding: ${narrow ? '2mm 2mm 5mm' : '3mm 3mm 6mm'};
    font: ${narrow ? '11px' : '12px'}/1.35 "Segoe UI", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
  }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .small { font-size: ${narrow ? '10px' : '11px'}; }
  .pre { white-space: pre-line; }
  .gap { height: 1.5mm; }
  .gap-top { margin-top: 1.5mm; }
  .name { font-size: ${narrow ? '15px' : '17px'}; font-weight: 800; line-height: 1.15; margin-bottom: 1mm; }
  .title { font-weight: 800; letter-spacing: 0.04em; margin-bottom: 1mm; }
  .copy { text-align: center; font-weight: 800; letter-spacing: 0.08em; margin-bottom: 1.5mm; }
  .sep { border-top: 1px dashed #000; margin: 2mm 0; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; }
  .row > span:first-child { min-width: 0; overflow-wrap: anywhere; }
  .row > span:last-child { white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
  .item { margin-bottom: 1.2mm; }
  .item-name { font-weight: 600; overflow-wrap: anywhere; }
  .calc { font-size: ${narrow ? '10px' : '11px'}; }
  .total { font-size: ${narrow ? '14px' : '16px'}; font-weight: 800; }
  .stamp { margin: 2mm 0; padding: 1mm; border: 2px solid #000; text-align: center; font-weight: 800; }
  .signatures { display: flex; gap: 4mm; margin-top: 12mm; text-align: center; }
  .signatures > div { flex: 1; }
  .line { border-top: 1px solid #000; margin-bottom: 1mm; }
  .printed { margin-top: 3mm; text-align: center; font-size: 9px; }
</style>
</head>
<body>
${body}
<div class="printed">Impreso ${escapeHtml(printed)}</div>
</body>
</html>`;
}
