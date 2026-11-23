import type { Role } from '../core/auth/auth-models';
import type { IconName } from '../shared/ui/icon/icons';

export interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  roles: readonly Role[];
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

const ALL: readonly Role[] = ['superadmin', 'admin', 'employee'];
const MANAGERS: readonly Role[] = ['superadmin', 'admin'];

/**
 * Menú lateral. Cada fase agrega aquí sus pantallas con los roles que pueden verlas
 * (mismos roles que el `roleGuard` de su ruta).
 */
export const NAV: readonly NavGroup[] = [
  {
    label: 'General',
    items: [{ label: 'Inicio', path: '/inicio', icon: 'dashboard', roles: ALL }],
  },
  {
    label: 'Operación',
    items: [
      { label: 'Punto de venta', path: '/venta', icon: 'cart', roles: ALL },
      { label: 'Caja', path: '/caja', icon: 'wallet', roles: ALL },
      { label: 'Ventas', path: '/ventas', icon: 'receipt', roles: ALL },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { label: 'Productos', path: '/productos', icon: 'package', roles: MANAGERS },
      { label: 'Categorías', path: '/categorias', icon: 'tags', roles: MANAGERS },
      { label: 'Proveedores', path: '/proveedores', icon: 'truck', roles: MANAGERS },
    ],
  },
  {
    label: 'Almacén',
    items: [
      { label: 'Existencias', path: '/almacen/existencias', icon: 'warehouse', roles: MANAGERS },
      { label: 'Entradas', path: '/almacen/entradas', icon: 'truck', roles: MANAGERS },
      {
        label: 'Movimientos',
        path: '/almacen/movimientos',
        icon: 'arrow-left-right',
        roles: MANAGERS,
      },
    ],
  },
  {
    label: 'Administración',
    items: [
      { label: 'Negocios', path: '/negocios', icon: 'store', roles: ['superadmin'] },
      { label: 'Usuarios', path: '/usuarios', icon: 'users', roles: MANAGERS },
    ],
  },
];
