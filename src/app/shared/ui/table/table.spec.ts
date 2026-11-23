import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PosCellDef } from './cell-def';
import { PosTable } from './table';
import type { TableColumn } from './table.types';

interface Row {
  id: string;
  name: string;
  priceCents: number;
}

@Component({
  imports: [PosTable, PosCellDef],
  template: `
    <pos-table caption="Prueba" [columns]="columns" [rows]="rows()" emptyTitle="Nada por aquí">
      <ng-template posCell="tag" [posCellOf]="rows()" let-row>
        <span class="tag">#{{ row.id }}</span>
      </ng-template>
    </pos-table>
  `,
})
class Host {
  readonly columns: TableColumn<Row>[] = [
    { key: 'name', header: 'Nombre', sortable: true },
    { key: 'priceCents', header: 'Precio', type: 'money', sortable: true },
    { key: 'tag', header: 'Etiqueta' },
  ];
  readonly rows = signal<Row[]>([
    { id: 'b', name: 'Pulpo', priceCents: 28900 },
    { id: 'a', name: 'Camarón', priceCents: 38900 },
  ]);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const cellTexts = (col: number) =>
    [...el.querySelectorAll(`tbody tr td:nth-child(${col})`)].map((td) => td.textContent?.trim());
  return { fixture, el, cellTexts };
}

describe('PosTable', () => {
  it('formatea dinero y usa plantillas de celda', async () => {
    const { el, cellTexts } = await render();
    expect(cellTexts(2)).toEqual(['$289.00', '$389.00']);
    expect([...el.querySelectorAll('.tag')].map((t) => t.textContent)).toEqual(['#b', '#a']);
  });

  it('ordena en cliente al hacer clic en el encabezado (asc → desc)', async () => {
    const { fixture, el, cellTexts } = await render();
    const sortButton = el.querySelector('th button') as HTMLButtonElement;

    sortButton.click();
    await fixture.whenStable();
    expect(cellTexts(1)).toEqual(['Camarón', 'Pulpo']);
    expect(el.querySelector('th')?.getAttribute('aria-sort')).toBe('ascending');

    sortButton.click();
    await fixture.whenStable();
    expect(cellTexts(1)).toEqual(['Pulpo', 'Camarón']);
  });

  it('muestra el estado vacío', async () => {
    const { fixture, el } = await render();
    fixture.componentInstance.rows.set([]);
    await fixture.whenStable();
    expect(el.textContent).toContain('Nada por aquí');
  });
});
