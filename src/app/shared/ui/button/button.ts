import { Component, booleanAttribute, computed, input } from '@angular/core';
import { PosIcon } from '../icon/icon';
import type { IconName } from '../icon/icons';
import { PosSpinner } from '../spinner/spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20, xl: 22 };

/**
 * Botón del sistema. Se aplica sobre el elemento nativo para conservar su semántica:
 *   <button posButton variant="primary" icon="plus" (click)="…">Nuevo</button>
 *   <button posButton variant="ghost" icon="pencil" iconOnly aria-label="Editar"></button>
 * `loading` deshabilita el botón y muestra un spinner en lugar del ícono.
 */
@Component({
  selector: 'button[posButton], a[posButton]',
  imports: [PosIcon, PosSpinner],
  template: `
    @if (loading()) {
      <pos-spinner [size]="iconSize()" />
    } @else if (icon(); as name) {
      <pos-icon [name]="name" [size]="iconSize()" />
    }
    @if (!iconOnly()) {
      <span class="label"><ng-content /></span>
    }
    @if (trailingIcon(); as name) {
      <pos-icon [name]="name" [size]="iconSize()" />
    }
  `,
  host: {
    '[class]': 'classes()',
    '[attr.disabled]': 'isDisabled() ? "" : null',
    '[attr.aria-disabled]': 'isDisabled() || null',
    '[attr.aria-busy]': 'loading() || null',
  },
  styleUrl: './button.scss',
})
export class PosButton {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly icon = input<IconName>();
  readonly trailingIcon = input<IconName>();
  readonly iconOnly = input(false, { transform: booleanAttribute });
  readonly block = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly iconSize = computed(() => ICON_SIZE[this.size()]);
  protected readonly isDisabled = computed(() => this.disabled() || this.loading());
  protected readonly classes = computed(() =>
    [
      'pos-button',
      `pos-button--${this.variant()}`,
      `pos-button--${this.size()}`,
      this.iconOnly() ? 'pos-button--icon-only' : '',
      this.block() ? 'pos-button--block' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
