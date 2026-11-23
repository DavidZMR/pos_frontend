import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthStore } from '../../core/auth/auth-store';
import { CurrentBusiness, type TicketDataInput } from '../../core/business/current-business';
import { PrinterStore } from '../../core/hardware/printer-store';
import { PosButton, PosCard, PosIcon, PosInput, PosTextarea, ToastService } from '../../shared/ui';
import { toApiError } from '../../core/api/api-types';
import { sampleSale } from '../pos/ticket/sample-sale';
import { saleTicketHtml } from '../pos/ticket/ticket-html';

const EMPTY: TicketDataInput = {
  name: '',
  legalName: '',
  taxId: '',
  phone: '',
  address: '',
  ticket: { header: '', footer: '' },
};

/** Datos del negocio que salen en el ticket, con vista previa en vivo. Aplica a todo el negocio. */
@Component({
  selector: 'pos-ticket-settings',
  imports: [PosButton, PosCard, PosIcon, PosInput, PosTextarea],
  template: `
    <pos-card heading="Datos del ticket">
      <span cardActions class="scope">Para todo el negocio</span>
      <div class="layout">
        <div class="form">
          <pos-input
            label="Nombre del negocio"
            [value]="draft().name"
            (valueChange)="patch({ name: $event })"
          />
          <div class="pair">
            <pos-input
              label="Razón social"
              [value]="draft().legalName"
              (valueChange)="patch({ legalName: $event })"
            />
            <pos-input
              label="RFC"
              [value]="draft().taxId"
              (valueChange)="patch({ taxId: $event })"
            />
          </div>
          <div class="pair">
            <pos-input
              label="Dirección"
              [value]="draft().address"
              (valueChange)="patch({ address: $event })"
            />
            <pos-input
              label="Teléfono"
              [value]="draft().phone"
              (valueChange)="patch({ phone: $event })"
            />
          </div>
          <pos-textarea
            label="Encabezado (opcional)"
            placeholder="p. ej. Sucursal Centro · Abierto de 8 a 18 h"
            [rows]="2"
            [value]="draft().ticket.header"
            (valueChange)="patchTicket({ header: $event })"
          />
          <pos-textarea
            label="Pie del ticket"
            placeholder="¡Gracias por su compra!"
            [rows]="2"
            [value]="draft().ticket.footer"
            (valueChange)="patchTicket({ footer: $event })"
          />
          <div class="actions">
            @if (dirty()) {
              <span class="unsaved"><pos-icon name="info" [size]="14" /> Cambios sin guardar</span>
            }
            <button
              posButton
              icon="check"
              [loading]="saving()"
              [disabled]="!dirty()"
              (click)="save()"
            >
              Guardar datos del ticket
            </button>
          </div>
        </div>

        <figure class="preview">
          <figcaption>Vista previa ({{ widthMm() }} mm)</figcaption>
          <!-- sandbox sin permisos: el ticket es HTML generado y escapado; no ejecuta nada. -->
          <iframe
            title="Vista previa del ticket"
            sandbox=""
            [style.width.px]="previewWidth()"
            [srcdoc]="preview()"
          ></iframe>
        </figure>
      </div>
    </pos-card>
  `,
  styles: `
    .scope {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
      gap: var(--space-6);
      align-items: start;
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .form {
      display: grid;
      gap: var(--space-4);
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: var(--space-4);
    }
    .actions {
      display: flex;
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
    }
    .preview {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
      margin: 0;
      padding: var(--space-4);
      background: var(--surface-sunken);
      border: var(--border);
      border-radius: var(--radius);
    }
    figcaption {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    iframe {
      max-width: 100%;
      height: 34rem;
      border: 1px solid var(--line-strong);
      background: #fff;
    }
  `,
})
export class PosTicketSettings {
  private readonly business = inject(CurrentBusiness);
  private readonly printer = inject(PrinterStore);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly saved = computed<TicketDataInput>(() => {
    const b = this.business.value();
    if (!b) return EMPTY;
    return {
      name: b.name ?? '',
      legalName: b.legalName ?? '',
      taxId: b.taxId ?? '',
      phone: b.phone ?? '',
      address: b.address ?? '',
      ticket: { header: b.ticket?.header ?? '', footer: b.ticket?.footer ?? '' },
    };
  });
  protected readonly draft = linkedSignal(() => this.saved());
  protected readonly saving = signal(false);

  protected readonly dirty = computed(
    () => JSON.stringify(this.draft()) !== JSON.stringify(this.saved()),
  );
  protected readonly widthMm = computed(() => this.printer.config().widthMm);
  protected readonly previewWidth = computed(() => Math.round((this.widthMm() * 96) / 25.4) + 2);

  protected readonly preview = computed(() =>
    // El HTML del ticket escapa todos los datos; el iframe además va sin permisos (sandbox="").
    this.sanitizer.bypassSecurityTrustHtml(
      saleTicketHtml(sampleSale(this.auth.user()?.name ?? 'Cajero'), this.draft(), {
        widthMm: this.widthMm(),
      }),
    ),
  );

  protected patch(changes: Partial<TicketDataInput>): void {
    this.draft.update((d) => ({ ...d, ...changes }));
  }

  protected patchTicket(changes: Partial<TicketDataInput['ticket']>): void {
    this.draft.update((d) => ({ ...d, ticket: { ...d.ticket, ...changes } }));
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    if (d.name.trim().length < 2) {
      this.toast.warning('El nombre del negocio debe tener al menos 2 caracteres');
      return;
    }
    this.saving.set(true);
    try {
      await this.business.updateTicketData({
        name: d.name.trim(),
        legalName: d.legalName.trim(),
        taxId: d.taxId.trim(),
        phone: d.phone.trim(),
        address: d.address.trim(),
        ticket: { header: d.ticket.header.trim(), footer: d.ticket.footer.trim() },
      });
      this.toast.success('Datos del ticket guardados');
    } catch (error) {
      this.toast.error(toApiError(error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
