import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import type { PrinterConfig } from '../../core/config/pos-bridge';
import { PrinterStore } from '../../core/hardware/printer-store';
import { sampleSale } from '../pos/ticket/sample-sale';
import { TicketPrinter } from '../pos/ticket/ticket-printer';
import {
  PosBadge,
  PosButton,
  PosCard,
  PosIcon,
  PosSelect,
  PosToggle,
  type SelectOption,
  ToastService,
} from '../../shared/ui';

interface PrinterDraft {
  name: string;
  widthMm: string;
  autoPrint: boolean;
  copies: string;
}

const toDraft = (c: PrinterConfig): PrinterDraft => ({
  name: c.name,
  widthMm: String(c.widthMm),
  autoPrint: c.autoPrint,
  copies: String(c.copies),
});

/** Impresora de tickets de esta PC: elegirla, papel, impresión automática y prueba. */
@Component({
  selector: 'pos-printer-settings',
  imports: [PosBadge, PosButton, PosCard, PosIcon, PosSelect, PosToggle],
  template: `
    <pos-card heading="Impresora de tickets">
      <pos-badge cardActions [tone]="status().tone">{{ status().label }}</pos-badge>

      <div class="form">
        <p class="help">
          Elige la impresora de tickets (térmica) instalada en Windows. Si no eliges ninguna, la app
          no ofrece imprimir y la venta sigue igual.
        </p>

        <div class="grid">
          <div class="printer">
            <pos-select
              label="Impresora"
              [options]="options()"
              [value]="draft().name"
              (valueChange)="patch({ name: $event })"
            />
            <button
              posButton
              variant="ghost"
              icon="refresh"
              iconOnly
              aria-label="Actualizar lista de impresoras"
              [loading]="refreshing()"
              (click)="refresh()"
            ></button>
          </div>
          <pos-select
            label="Ancho del papel"
            [options]="widthOptions"
            [value]="draft().widthMm"
            (valueChange)="patch({ widthMm: $event })"
          />
          <pos-select
            label="Copias"
            [options]="copiesOptions"
            [value]="draft().copies"
            (valueChange)="patch({ copies: $event })"
          />
        </div>

        <pos-toggle
          label="Imprimir automáticamente al cobrar"
          description="Si está apagado, al terminar la venta aparece el botón Imprimir (F9)."
          [checked]="draft().autoPrint"
          [disabled]="!draft().name"
          (checkedChange)="patch({ autoPrint: $event })"
        />

        @if (store.missing()) {
          <p class="warn" role="status">
            <pos-icon name="alert" [size]="16" />
            "{{ store.config().name }}" no aparece en Windows: revisa que esté encendida y
            conectada, o elige otra.
          </p>
        }

        <div class="actions">
          @if (dirty()) {
            <span class="unsaved"><pos-icon name="info" [size]="14" /> Cambios sin guardar</span>
          }
          <button
            posButton
            variant="secondary"
            icon="printer"
            [disabled]="!store.ready() || dirty()"
            [loading]="testing()"
            (click)="testPrint()"
          >
            Imprimir prueba
          </button>
          <button posButton icon="check" [loading]="saving()" (click)="save()">Guardar</button>
        </div>
      </div>
    </pos-card>
  `,
  styles: `
    .form {
      display: grid;
      gap: var(--space-4);
    }
    .help {
      max-width: 65ch;
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--space-4);
    }
    @media (max-width: 900px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .printer {
      display: flex;
      align-items: flex-end;
      gap: var(--space-1);
      pos-select {
        flex: 1;
        min-width: 0;
      }
    }
    .warn {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      color: var(--warning-ink);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-2);
      border-top: var(--border);
    }
    .unsaved {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
      color: var(--warning-ink);
      margin-inline-end: auto;
    }
  `,
})
export class PosPrinterSettings {
  protected readonly store = inject(PrinterStore);
  private readonly tickets = inject(TicketPrinter);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);

  protected readonly draft = linkedSignal(() => toDraft(this.store.config()));
  protected readonly refreshing = signal(false);
  protected readonly saving = signal(false);
  protected readonly testing = signal(false);

  protected readonly widthOptions: SelectOption[] = [
    { value: '80', label: '80 mm (la más común)' },
    { value: '58', label: '58 mm' },
  ];
  protected readonly copiesOptions: SelectOption[] = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
  ];

  protected readonly options = computed<SelectOption[]>(() => {
    const printers = this.store.printers();
    const options: SelectOption[] = [{ value: '', label: 'Sin impresora (no imprimir)' }];
    for (const p of printers) {
      const notes = [
        p.isDefault ? 'predeterminada' : '',
        this.store.looksLikeTicketPrinter(p) ? 'de tickets' : '',
      ]
        .filter(Boolean)
        .join(', ');
      options.push({ value: p.name, label: notes ? `${p.displayName} (${notes})` : p.displayName });
    }
    const saved = this.store.config().name;
    if (saved && !printers.some((p) => p.name === saved)) {
      options.push({ value: saved, label: `${saved} (no encontrada)` });
    }
    return options;
  });

  protected readonly status = computed(() => {
    if (this.store.ready()) return { tone: 'success' as const, label: 'Lista' };
    if (this.store.missing()) return { tone: 'danger' as const, label: 'No encontrada' };
    return { tone: 'neutral' as const, label: 'Sin impresora' };
  });

  protected readonly dirty = computed(
    () => JSON.stringify(this.draft()) !== JSON.stringify(toDraft(this.store.config())),
  );

  protected patch(changes: Partial<PrinterDraft>): void {
    this.draft.update((d) => ({
      ...d,
      ...changes,
      ...(changes.name === '' && { autoPrint: false }),
    }));
  }

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.store.refresh();
    } finally {
      this.refreshing.set(false);
    }
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    this.saving.set(true);
    try {
      await this.store.saveConfig({
        name: d.name,
        widthMm: Number(d.widthMm) as 58 | 80,
        autoPrint: d.autoPrint && Boolean(d.name),
        copies: Number(d.copies),
      });
      this.toast.success(
        d.name ? `Impresora de tickets: ${d.name}` : 'Sin impresora: no se imprimirán tickets',
      );
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      this.saving.set(false);
    }
  }

  protected async testPrint(): Promise<void> {
    this.testing.set(true);
    try {
      await this.tickets.printSample(sampleSale(this.auth.user()?.name ?? 'Cajero'));
    } finally {
      this.testing.set(false);
    }
  }
}
