import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  Directive,
  type ElementRef,
  TemplateRef,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { debounced } from '../../utils/debounced';
import { uniqueId } from '../field/field-state';
import { PosIcon } from '../icon/icon';
import type { IconName } from '../icon/icons';
import { PosSpinner } from '../spinner/spinner';

export interface PosOptionContext<T> {
  $implicit: T;
  active: boolean;
}

/** Plantilla de cada opción: `<ng-template posOption [posOptionOf]="ejemplo" let-item>…` */
@Directive({ selector: 'ng-template[posOption]' })
export class PosOptionDef<T> {
  /** Solo para tipar `let-item`; puede ser cualquier arreglo del tipo de las opciones. */
  readonly posOptionOf = input<readonly T[]>();
  readonly template = inject<TemplateRef<PosOptionContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: PosOptionDef<T>,
    ctx: unknown,
  ): ctx is PosOptionContext<T> {
    return true;
  }
}

/**
 * Buscador con lista de sugerencias (combobox accesible).
 * - Escribe → busca con `search(term)` tras 200 ms.
 * - ↑/↓ recorre, Enter elige (si aún no hay resultados, busca y elige el primero: sirve con
 *   lector de código de barras que teclea el código + Enter), Esc cierra/limpia.
 * - Al elegir emite `(selected)` y se limpia para capturar el siguiente.
 */
@Component({
  selector: 'pos-autocomplete',
  imports: [NgTemplateOutlet, PosIcon, PosSpinner],
  templateUrl: './autocomplete.html',
  styleUrl: './autocomplete.scss',
})
export class PosAutocomplete<T> {
  readonly label = input('');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly icon = input<IconName>('search');
  readonly emptyText = input('Sin resultados');
  readonly minLength = input(1);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly search = input.required<(term: string) => Promise<readonly T[]>>();
  readonly trackBy = input<(item: T) => unknown>((item) => (item as { id?: unknown }).id ?? item);

  readonly selected = output<T>();

  private readonly optionDef = contentChild(PosOptionDef);
  private readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('native');

  protected readonly controlId = uniqueId('pos-autocomplete');
  protected readonly listId = `${this.controlId}-list`;

  protected readonly term = signal('');
  private readonly searchTerm = debounced(this.term, 200);
  protected readonly open = signal(false);

  protected readonly results = resource({
    params: () => {
      const term = this.searchTerm().trim();
      return term.length >= this.minLength() ? term : undefined;
    },
    loader: ({ params }) => this.search()(params),
  });

  protected readonly items = computed(() => (this.results.hasValue() ? this.results.value() : []));
  protected readonly active = linkedSignal<number>(() => (this.items().length > 0 ? 0 : -1));
  protected readonly template = computed(() => this.optionDef()?.template);
  protected readonly showPanel = computed(
    () => this.open() && this.term().trim().length >= this.minLength(),
  );
  protected readonly activeId = computed(() =>
    this.showPanel() && this.active() >= 0 ? `${this.controlId}-opt-${this.active()}` : null,
  );

  protected onInput(value: string): void {
    this.term.set(value);
    this.open.set(true);
  }

  protected async onKeydown(event: KeyboardEvent): Promise<void> {
    const count = this.items().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        if (count) this.active.set(Math.min(this.active() + 1, count - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.active.set(Math.max(this.active() - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const term = this.term().trim();
        if (!term) return;
        const fresh = this.searchTerm().trim() === term && !this.results.isLoading();
        if (fresh && this.active() >= 0) {
          const item = this.items()[this.active()];
          if (item !== undefined) this.choose(item);
          return;
        }
        const [first] = await this.search()(term);
        if (first !== undefined) this.choose(first);
        break;
      }
      case 'Escape':
        if (this.open()) this.open.set(false);
        else this.term.set('');
        break;
      case 'Tab':
        this.open.set(false);
        break;
    }
  }

  protected choose(item: T): void {
    this.selected.emit(item);
    this.term.set('');
    this.open.set(false);
    this.inputEl().nativeElement.focus();
  }

  protected onBlur(): void {
    // Las opciones usan mousedown.preventDefault, así que el clic llega antes de cerrar.
    this.open.set(false);
  }

  focus(): void {
    this.inputEl().nativeElement.focus();
  }
}
