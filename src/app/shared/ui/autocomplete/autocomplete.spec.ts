import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PosAutocomplete, PosOptionDef } from './autocomplete';

interface Item {
  id: string;
  name: string;
}

const ITEMS: Item[] = [
  { id: '1', name: 'Camarón grande' },
  { id: '2', name: 'Camarón mediano' },
  { id: '3', name: 'Pulpo' },
];

@Component({
  imports: [PosAutocomplete, PosOptionDef],
  template: `
    <pos-autocomplete label="Producto" [search]="search" (selected)="picked.push($event)">
      <ng-template posOption [posOptionOf]="items" let-item>
        <span class="opt">{{ item.name }}</span>
      </ng-template>
    </pos-autocomplete>
  `,
})
class Host {
  readonly items = ITEMS;
  readonly picked: Item[] = [];
  calls = 0;
  readonly search = async (term: string) => {
    this.calls++;
    return ITEMS.filter((i) => i.name.toLowerCase().includes(term.toLowerCase()));
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('PosAutocomplete', () => {
  it('busca al escribir, navega con flechas y elige con Enter', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;

    input.dispatchEvent(new Event('focus'));
    input.value = 'cama';
    input.dispatchEvent(new Event('input'));
    await wait(300);
    await fixture.whenStable();

    expect([...el.querySelectorAll('.opt')].map((o) => o.textContent)).toEqual([
      'Camarón grande',
      'Camarón mediano',
    ]);
    expect(input.getAttribute('aria-expanded')).toBe('true');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await fixture.whenStable();
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-1$/);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.picked.map((p) => p.id)).toEqual(['2']);
    expect(input.value).toBe('');
  });

  it('Enter inmediato (lector de código) busca y elige el primero sin esperar', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;

    input.value = 'pulpo';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wait(0);
    await fixture.whenStable();

    expect(fixture.componentInstance.picked.map((p) => p.name)).toEqual(['Pulpo']);
  });
});
