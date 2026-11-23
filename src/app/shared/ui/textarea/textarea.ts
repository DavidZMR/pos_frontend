import { Component, type ElementRef, input, model, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { PosFieldBase } from '../field/field-state';

/** Texto largo (notas, motivos). Compatible con Signal Forms. */
@Component({
  selector: 'pos-textarea',
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
      <textarea
        #native
        class="area"
        [class.area--invalid]="showErrors()"
        [id]="controlId"
        [rows]="rows()"
        [value]="value()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        [attr.name]="name() || null"
        [attr.placeholder]="placeholder() || null"
        [attr.maxlength]="maxLength() ?? null"
        [attr.aria-invalid]="showErrors()"
        [attr.aria-describedby]="describedBy()"
        (input)="value.set(native.value)"
        (blur)="touch.emit()"
      ></textarea>
      @if (showErrors()) {
        <span class="error" [id]="errorId">{{ firstError() }}</span>
      } @else if (hint()) {
        <span class="hint" [id]="hintId">{{ hint() }}</span>
      }
    </div>
  `,
  styleUrl: './textarea.scss',
})
export class PosTextarea extends PosFieldBase implements FormValueControl<string> {
  readonly value = model('');
  readonly rows = input(3);
  readonly placeholder = input('');
  readonly maxLength = input<number | undefined>(undefined);

  private readonly native = viewChild.required<ElementRef<HTMLTextAreaElement>>('native');

  focus(options?: FocusOptions): void {
    this.native().nativeElement.focus(options);
  }
}
