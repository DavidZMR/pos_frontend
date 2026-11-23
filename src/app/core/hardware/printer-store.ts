import { DOCUMENT } from '@angular/common';
import { Service, computed, inject, signal } from '@angular/core';
import type { PrintResult, PrinterConfig, PrinterInfo } from '../config/pos-bridge';

const NO_PRINTER: PrinterConfig = { name: '', widthMm: 80, autoPrint: false, copies: 1 };

/** Nombres típicos de impresoras de tickets (para sugerirla al configurar). */
const THERMAL =
  /pos|ticket|thermal|t[eé]rmica|receipt|tm-?t|xprinter|xp-?\d|58|80\s?mm|epson tm|bixolon|star tsp|zjiang|3nstar|ec line/i;

/**
 * Impresora de tickets de esta PC (app de escritorio). Sin impresora configurada —o en el
 * navegador— `ready` es false y la app simplemente no ofrece imprimir.
 */
@Service()
export class PrinterStore {
  private readonly bridge = inject(DOCUMENT).defaultView?.pos;

  readonly supported = Boolean(this.bridge?.printer);
  readonly config = signal<PrinterConfig>(NO_PRINTER);
  readonly printers = signal<PrinterInfo[]>([]);
  readonly loaded = signal(false);

  /** La impresora configurada está instalada en Windows: se puede imprimir. */
  readonly ready = computed(() => {
    const name = this.config().name;
    return Boolean(name) && this.printers().some((p) => p.name === name);
  });
  /** Configurada pero no aparece en Windows (desconectada, desinstalada, renombrada). */
  readonly missing = computed(() => this.loaded() && Boolean(this.config().name) && !this.ready());

  constructor() {
    if (this.supported) void this.refresh();
  }

  /** Vuelve a leer la configuración y la lista de impresoras de Windows. */
  async refresh(): Promise<void> {
    if (!this.bridge?.printer || !this.bridge.hardware) return;
    const [config, printers] = await Promise.all([
      this.bridge.hardware.getConfig(),
      this.bridge.printer.list(),
    ]);
    this.config.set(config.printer);
    this.printers.set(printers);
    this.loaded.set(true);
  }

  async saveConfig(config: PrinterConfig): Promise<PrinterConfig> {
    if (!this.bridge?.printer)
      throw new Error('La impresora solo se configura en la app de escritorio');
    const saved = await this.bridge.printer.saveConfig(config);
    this.config.set(saved);
    return saved;
  }

  print(html: string): Promise<PrintResult> {
    if (!this.bridge?.printer) {
      return Promise.resolve({ ok: false, error: 'Solo se imprime desde la app de escritorio' });
    }
    return this.bridge.printer.print({ html });
  }

  /** ¿Parece impresora de tickets? (solo para sugerirla). */
  looksLikeTicketPrinter(printer: PrinterInfo): boolean {
    return THERMAL.test(`${printer.name} ${printer.displayName}`);
  }
}
