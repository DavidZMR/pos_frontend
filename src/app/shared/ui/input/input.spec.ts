import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, required } from '@angular/forms/signals';
import { PosInput } from './input';

@Component({
  imports: [PosInput, FormField],
  template: `<pos-input label="Usuario" [formField]="f.username" />`,
})
class Host {
  readonly model = signal({ username: '' });
  readonly f = form(this.model, (s) => {
    required(s.username, { message: 'Escribe el usuario' });
  });
}

describe('PosInput con Signal Forms', () => {
  it('actualiza el modelo al escribir y asocia el label', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    const label = el.querySelector('label') as HTMLLabelElement;

    input.value = 'ana';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.model().username).toBe('ana');
    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toContain('*');
  });

  it('muestra el error solo después de tocar el campo', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;

    expect(el.querySelector('.error')).toBeNull();

    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(el.querySelector('.error')?.textContent).toContain('Escribe el usuario');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(el.querySelector('.error')?.id);
  });
});
