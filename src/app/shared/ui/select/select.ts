import { Component, type ElementRef, input, model, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { PosFieldBase } from '../field/field-state';
import { PosIcon } from '../icon/icon';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Lista desplegable nativa (rápida y accesible) compatible con Signal Forms:
 *   <pos-select label="Rol" [options]="roleOptions" [formField]="userForm.role" />
 */
@Component({
  selector: 'pos-select',
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
        <select
          #native
          class="native"
          [id]="controlId"
          [disabled]="disabled() || readonly()"
          [attr.name]="name() || null"
          [attr.aria-invalid]="showErrors()"
          [attr.aria-required]="required() || null"
          [attr.aria-describedby]="describedBy()"
          (change)="value.set(native.value)"
          (blur)="touch.emit()"
        >
          @if (placeholder()) {
            <option value="" [selected]="value() === ''">{{ placeholder() }}</option>
          }
          @for (option of options(); track option.value) {
            <option
              [value]="option.value"
              [disabled]="option.disabled ?? false"
              [selected]="option.value === value()"
            >
              {{ option.label }}
            </option>
          }
        </select>
        <pos-icon class="chevron" name="chevron-down" [size]="18" />
      </div>
      @if (showErrors()) {
        <span class="error" [id]="errorId">{{ firstError() }}</span>
      } @else if (hint()) {
        <span class="hint" [id]="hintId">{{ hint() }}</span>
      }
    </div>
  `,
  styleUrl: './select.scss',
})
export class PosSelect extends PosFieldBase implements FormValueControl<string> {
  readonly value = model('');
  readonly options = input<readonly SelectOption[]>([]);
  readonly placeholder = input('');

  private readonly native = viewChild.required<ElementRef<HTMLSelectElement>>('native');

  focus(options?: FocusOptions): void {
    this.native().nativeElement.focus(options);
  }
}
