import {
  Component,
  type ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { PosFieldBase } from '../field/field-state';
import { PosIcon } from '../icon/icon';
import type { IconName } from '../icon/icons';

export type InputType = 'text' | 'password' | 'email' | 'search' | 'tel' | 'url';

/**
 * Campo de texto compatible con Signal Forms:
 *   <pos-input label="Usuario" [formField]="loginForm.username" autocomplete="username" />
 */
@Component({
  selector: 'pos-input',
  imports: [PosIcon],
  template: `
    <div class="field">
      @if (label()) {
        <label class="label" [for]="controlId">
          {{ label() }}
          @if (required()) {
            <span class="req" aria-hidden="true">*</span>
          }
        </label>
      }
      <div
        class="control"
        [class.control--invalid]="showErrors()"
        [class.control--disabled]="disabled()"
      >
        @if (icon(); as name) {
          <pos-icon class="lead" [name]="name" [size]="18" />
        }
        @if (prefix()) {
          <span class="affix">{{ prefix() }}</span>
        }
        <input
          #native
          class="native"
          [id]="controlId"
          [type]="effectiveType()"
          [value]="value()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          [attr.name]="name() || null"
          [attr.placeholder]="placeholder() || null"
          [attr.autocomplete]="autocomplete()"
          [attr.inputmode]="inputmode() || null"
          [attr.aria-invalid]="showErrors()"
          [attr.aria-required]="required() || null"
          [attr.aria-describedby]="describedBy()"
          (input)="value.set(native.value)"
          (blur)="touch.emit()"
        />
        @if (suffix()) {
          <span class="affix">{{ suffix() }}</span>
        }
        @if (type() === 'password') {
          <button
            type="button"
            class="reveal"
            [attr.aria-label]="revealed() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            [attr.aria-pressed]="revealed()"
            (click)="revealed.update((v) => !v)"
          >
            <pos-icon [name]="revealed() ? 'eye-off' : 'eye'" [size]="18" />
          </button>
        }
      </div>
      @if (showErrors()) {
        <span class="error" [id]="errorId">{{ firstError() }}</span>
      } @else if (hint()) {
        <span class="hint" [id]="hintId">{{ hint() }}</span>
      }
    </div>
  `,
  styleUrl: './input.scss',
})
export class PosInput extends PosFieldBase implements FormValueControl<string> {
  readonly value = model('');
  readonly type = input<InputType>('text');
  readonly placeholder = input('');
  readonly icon = input<IconName>();
  readonly prefix = input('');
  readonly suffix = input('');
  readonly autocomplete = input('off');
  readonly inputmode = input<'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'search' | ''>('');

  protected readonly revealed = signal(false);
  protected readonly effectiveType = computed(() =>
    this.type() === 'password' && this.revealed() ? 'text' : this.type(),
  );

  private readonly native = viewChild.required<ElementRef<HTMLInputElement>>('native');

  focus(options?: FocusOptions): void {
    this.native().nativeElement.focus(options);
  }
}
