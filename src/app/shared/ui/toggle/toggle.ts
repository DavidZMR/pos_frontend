import { Component, input, model, output } from '@angular/core';
import type { FormCheckboxControl } from '@angular/forms/signals';
import { uniqueId } from '../field/field-state';

/**
 * Interruptor (checkbox con rol switch) compatible con Signal Forms:
 *   <pos-toggle label="Activo" [formField]="userForm.active" />
 */
@Component({
  selector: 'pos-toggle',
  template: `
    <label class="toggle" [class.toggle--disabled]="disabled()" [for]="controlId">
      <input
        type="checkbox"
        role="switch"
        class="native"
        [id]="controlId"
        [checked]="checked()"
        [disabled]="disabled() || readonly()"
        [attr.name]="name() || null"
        [attr.aria-checked]="checked()"
        [attr.aria-describedby]="description() ? controlId + '-desc' : null"
        (change)="checked.set(native.checked)"
        (blur)="touch.emit()"
        #native
      />
      <span class="track" aria-hidden="true"><span class="thumb"></span></span>
      <span class="text">
        <span class="label">{{ label() }}</span>
        @if (description()) {
          <span class="description" [id]="controlId + '-desc'">{{ description() }}</span>
        }
      </span>
    </label>
  `,
  styleUrl: './toggle.scss',
})
export class PosToggle implements FormCheckboxControl {
  readonly checked = model(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly name = input('');
  readonly touch = output<void>();
  readonly label = input.required<string>();
  readonly description = input('');

  protected readonly controlId = uniqueId('pos-toggle');
}
