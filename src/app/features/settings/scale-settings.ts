import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import type { ScaleConfig } from '../../core/config/pos-bridge';
import { ScaleStore } from '../../core/hardware/scale-store';
import {
  PosBadge,
  PosButton,
  PosCard,
  PosIcon,
  PosInput,
  PosSelect,
  PosToggle,
  type SelectOption,
  ToastService,
} from '../../shared/ui';
import { formatQty } from '../../shared/utils/format';

const BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

/** Formulario en texto (los selects trabajan con strings). */
interface ScaleDraft {
  enabled: boolean;
  path: string;
  baudRate: string;
  dataBits: string;
  parity: string;
  stopBits: string;
  mode: string;
  command: string;
}

function toDraft(config: ScaleConfig): ScaleDraft {
  return {
    enabled: config.enabled,
    path: config.path,
    baudRate: String(config.baudRate),
    dataBits: String(config.dataBits),
    parity: config.parity,
    stopBits: String(config.stopBits),
    mode: config.mode,
    command: config.command,
  };
}

/** Báscula de esta PC: búsqueda automática, ajustes del puerto y lectura en vivo. */
@Component({
  selector: 'pos-scale-settings',
  imports: [PosBadge, PosButton, PosCard, PosIcon, PosInput, PosSelect, PosToggle],
  templateUrl: './scale-settings.html',
  styleUrl: './scale-settings.scss',
})
export class PosScaleSettings {
  /** Configuración guardada al abrir la pantalla. */
  readonly config = input.required<ScaleConfig>();

  protected readonly scale = inject(ScaleStore);
  private readonly toast = inject(ToastService);

  protected readonly draft = linkedSignal(() => toDraft(this.config()));
  /** Lo que de verdad quedó guardado (para comparar con el borrador). */
  private readonly saved = linkedSignal(() => this.config());
  /** Adaptador USB elegido en esta sesión (null = el que ya estaba guardado). */
  private match: ScaleConfig['match'] | null = null;

  protected readonly ports = signal<SelectOption[]>([]);
  protected readonly loadingPorts = signal(false);
  protected readonly detecting = signal(false);
  protected readonly progress = signal('');
  protected readonly saving = signal(false);
  protected readonly showAdvanced = signal(false);

  protected readonly baudOptions: SelectOption[] = BAUD_RATES.map((b) => ({
    value: String(b),
    label: `${b} baudios`,
  }));
  protected readonly modeOptions: SelectOption[] = [
    { value: 'continuous', label: 'La báscula manda el peso sola' },
    { value: 'request', label: 'Hay que pedirle el peso (comando)' },
  ];
  protected readonly dataBitsOptions: SelectOption[] = [
    { value: '8', label: '8' },
    { value: '7', label: '7' },
  ];
  protected readonly parityOptions: SelectOption[] = [
    { value: 'none', label: 'Ninguna' },
    { value: 'even', label: 'Par' },
    { value: 'odd', label: 'Impar' },
  ];
  protected readonly stopBitsOptions: SelectOption[] = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
  ];

  protected readonly dirty = computed(
    () => JSON.stringify(this.draft()) !== JSON.stringify(toDraft(this.saved())),
  );

  /** Estado en vivo para la cabecera de la tarjeta. */
  protected readonly live = computed(() => {
    const status = this.scale.status();
    const reading = this.scale.reading();
    const tone =
      status.state === 'connected'
        ? 'success'
        : status.state === 'disabled'
          ? 'neutral'
          : status.state === 'error'
            ? 'danger'
            : 'warning';
    const label = {
      disabled: 'Sin báscula',
      connecting: 'Conectando',
      waiting: 'Sin datos',
      connected: 'Conectada',
      error: 'Desconectada',
    }[status.state];
    return {
      tone: tone as 'success' | 'neutral' | 'danger' | 'warning',
      label,
      message: status.message,
      weight: reading ? formatQty(Math.max(reading.grams, 0), 'kg') : '',
      stable: reading?.stable ?? false,
    };
  });

  constructor() {
    void this.refreshPorts();
  }

  protected patch(changes: Partial<ScaleDraft>): void {
    this.draft.update((d) => ({ ...d, ...changes }));
  }

  protected async refreshPorts(): Promise<void> {
    this.loadingPorts.set(true);
    try {
      const ports = await this.scale.listPorts();
      const options = ports.map((p) => ({ value: p.path, label: p.label }));
      // El puerto guardado se muestra aunque ahora no esté conectado.
      const current = this.draft().path;
      if (current && !options.some((o) => o.value === current)) {
        options.unshift({ value: current, label: `${current} (no conectado)` });
      }
      this.ports.set(options);
    } finally {
      this.loadingPorts.set(false);
    }
  }

  /** Al elegir un puerto se recuerda su adaptador USB, para seguirlo si Windows le cambia el COM. */
  protected async selectPort(path: string): Promise<void> {
    this.patch({ path });
    const info = (await this.scale.listPorts()).find((p) => p.path === path);
    if (info) {
      this.match = {
        serialNumber: info.serialNumber,
        vendorId: info.vendorId,
        productId: info.productId,
      };
    }
  }

  protected async detect(): Promise<void> {
    this.detecting.set(true);
    this.progress.set('Buscando báscula…');
    try {
      const { scale: found, message } = await this.scale.detect((text) => this.progress.set(text));
      if (!found) {
        this.progress.set(message || 'No se encontró una báscula.');
        return;
      }
      const { sampleGrams, ...config } = found;
      if (!(await this.persist(config))) return;
      this.draft.set(toDraft(config));
      await this.refreshPorts();
      this.progress.set(
        `Báscula encontrada en ${config.path} (${config.baudRate} baudios). Leyó ${formatQty(Math.max(sampleGrams, 0), 'kg')}.`,
      );
    } catch (error) {
      this.progress.set('');
      this.toast.error(error instanceof Error ? error.message : 'No se pudo buscar la báscula');
    } finally {
      this.detecting.set(false);
    }
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    if (d.enabled && !d.path) {
      this.toast.warning('Elige el puerto de la báscula o usa "Buscar báscula"');
      return;
    }
    if (d.enabled && d.mode === 'request' && !d.command.trim()) {
      this.toast.warning('Escribe el comando para pedir el peso (p. ej. P)');
      return;
    }
    const ok = await this.persist({
      enabled: d.enabled,
      path: d.path,
      baudRate: Number(d.baudRate),
      dataBits: Number(d.dataBits) as 7 | 8,
      parity: d.parity as ScaleConfig['parity'],
      stopBits: Number(d.stopBits) as 1 | 2,
      mode: d.mode as ScaleConfig['mode'],
      command: d.command.trim(),
      intervalMs: this.saved().intervalMs,
      match: this.match ?? this.saved().match,
    });
    if (!ok) return;
    this.toast.success(
      d.enabled
        ? `Báscula guardada; conectando en ${d.path}…`
        : 'Sin báscula: el cajero escribirá el peso',
    );
  }

  private async persist(config: ScaleConfig): Promise<boolean> {
    this.saving.set(true);
    try {
      const stored = await this.scale.saveConfig(config);
      this.saved.set(stored);
      this.match = stored.match;
      return true;
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
      return false;
    } finally {
      this.saving.set(false);
    }
  }
}
