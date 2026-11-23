import { Component, inject, signal } from '@angular/core';
import { FormField, form, minLength, required, submit } from '@angular/forms/signals';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import {
  ConfirmService,
  PosBadge,
  PosButton,
  PosCard,
  PosCellDef,
  PosInput,
  PosPageHeader,
  PosSelect,
  PosTable,
  PosToggle,
  type SelectOption,
  type TableColumn,
  ToastService,
} from '../../shared/ui';
import type { Unit } from '../../shared/utils/qty';

interface DemoProduct {
  id: string;
  code: string;
  name: string;
  unit: Unit;
  salePriceCents: number;
  stock: number;
  active: boolean;
}

const PRODUCTS: DemoProduct[] = [
  {
    id: '1',
    code: '101',
    name: 'Camarón grande U-15',
    unit: 'kg',
    salePriceCents: 38900,
    stock: 12450,
    active: true,
  },
  {
    id: '2',
    code: '102',
    name: 'Pulpo cocido',
    unit: 'kg',
    salePriceCents: 28900,
    stock: 3200,
    active: true,
  },
  {
    id: '3',
    code: '205',
    name: 'Filete de huachinango',
    unit: 'kg',
    salePriceCents: 24500,
    stock: 0,
    active: false,
  },
  {
    id: '4',
    code: '310',
    name: 'Ostión en concha (docena)',
    unit: 'pz',
    salePriceCents: 18000,
    stock: 24,
    active: true,
  },
  {
    id: '5',
    code: '402',
    name: 'Clamato preparado 1 l',
    unit: 'l',
    salePriceCents: 6500,
    stock: 18000,
    active: true,
  },
];

/** Muestrario del sistema de diseño (solo desarrollo): /kit */
@Component({
  selector: 'pos-ui-kit-page',
  imports: [
    FormField,
    MoneyPipe,
    PosBadge,
    PosButton,
    PosCard,
    PosCellDef,
    PosInput,
    PosPageHeader,
    PosSelect,
    PosTable,
    PosToggle,
  ],
  templateUrl: './ui-kit-page.html',
  styleUrl: './ui-kit-page.scss',
})
export class UiKitPage {
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly products = signal(PRODUCTS);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  protected readonly columns: TableColumn<DemoProduct>[] = [
    { key: 'code', header: 'Código', width: '6rem', sortable: true },
    { key: 'name', header: 'Producto', sortable: true },
    { key: 'salePriceCents', header: 'Precio', type: 'money', sortable: true },
    { key: 'stock', header: 'Existencia', type: 'qty', unit: (p) => p.unit, hideOnMobile: true },
    { key: 'status', header: 'Estado', width: '8rem' },
    { key: 'actions', header: '', width: '6rem', align: 'end' },
  ];

  protected readonly roleOptions: SelectOption[] = [
    { value: 'admin', label: 'Administrador' },
    { value: 'employee', label: 'Empleado' },
  ];

  protected readonly model = signal({
    name: '',
    username: '',
    password: '',
    role: '',
    active: true,
  });
  protected readonly demoForm = form(this.model, (s) => {
    required(s.name, { message: 'Escribe el nombre' });
    minLength(s.name, 2, { message: 'Mínimo 2 caracteres' });
    required(s.username, { message: 'Escribe el usuario' });
    required(s.password, { message: 'Escribe una contraseña' });
    minLength(s.password, 8, { message: 'Mínimo 8 caracteres' });
    required(s.role, { message: 'Elige un rol' });
  });

  protected save(): void {
    submit(this.demoForm, async () => {
      this.saving.set(true);
      await new Promise((resolve) => setTimeout(resolve, 900));
      this.saving.set(false);
      this.toast.success(`Usuario "${this.model().username}" guardado`);
    });
  }

  protected async remove(product: DemoProduct): Promise<void> {
    const ok = await this.confirm.ask({
      heading: '¿Desactivar producto?',
      message: `"${product.name}" dejará de aparecer en la pantalla de venta.`,
      confirmText: 'Desactivar',
      tone: 'danger',
    });
    if (ok) this.toast.warning(`"${product.name}" desactivado`);
  }

  protected reload(): void {
    this.loading.set(true);
    this.products.set([]);
    setTimeout(() => {
      this.products.set(PRODUCTS);
      this.loading.set(false);
    }, 1200);
  }

  protected showError(): void {
    this.toast.error('No se pudo conectar con el servidor. Revisa tu conexión a internet.');
  }
}
