import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PosButton } from './button';

@Component({
  imports: [PosButton],
  template: `
    <button
      posButton
      variant="danger"
      icon="trash"
      [loading]="loading()"
      (click)="clicks = clicks + 1"
    >
      Eliminar
    </button>
  `,
})
class Host {
  readonly loading = signal(false);
  clicks = 0;
}

@Component({
  imports: [PosButton],
  template: `
    <form (submit)="submitted = submitted + 1; $event.preventDefault()">
      <input id="field" />
      <button
        posButton
        icon="x"
        iconOnly
        aria-label="Cerrar"
        (click)="closed = closed + 1"
      ></button>
      <button posButton type="submit">Guardar</button>
    </form>
  `,
})
class FormHost {
  submitted = 0;
  closed = 0;
}

describe('PosButton', () => {
  it('es type="button" por defecto: Enter en un campo envía con el botón submit, no "cierra"', async () => {
    const fixture = TestBed.createComponent(FormHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const [close, save] = Array.from(el.querySelectorAll('button'));

    expect(close?.getAttribute('type')).toBe('button');
    expect(save?.getAttribute('type')).toBe('submit');

    (el.querySelector('form') as HTMLFormElement).requestSubmit();
    expect(fixture.componentInstance.submitted).toBe(1);
    expect(fixture.componentInstance.closed).toBe(0);
  });

  it('aplica variante y tamaño como clases del botón nativo', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;

    expect(button.classList).toContain('pos-button--danger');
    expect(button.classList).toContain('pos-button--md');
    expect(button.querySelector('pos-icon')).not.toBeNull();
  });

  it('en loading se deshabilita, marca aria-busy y no dispara clicks', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;

    button.click();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('pos-spinner')).not.toBeNull();
    expect(fixture.componentInstance.clicks).toBe(0);
  });
});
