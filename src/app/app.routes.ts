import { isDevMode } from '@angular/core';
import type { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/guards';

const TITLE = 'PuntoVenta';

export const routes: Routes = [
  {
    path: 'login',
    title: `Iniciar sesión · ${TITLE}`,
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  ...(isDevMode()
    ? [
        {
          path: 'kit',
          title: `Sistema de diseño · ${TITLE}`,
          loadComponent: () => import('./features/ui-kit/ui-kit-page').then((m) => m.UiKitPage),
        },
      ]
    : []),
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: `Inicio · ${TITLE}`,
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'venta',
        title: `Punto de venta · ${TITLE}`,
        data: { fullBleed: true },
        loadComponent: () => import('./features/pos/pos-page').then((m) => m.PosPage),
      },
      {
        path: 'caja',
        title: `Caja · ${TITLE}`,
        loadComponent: () => import('./features/pos/cash/cash-page').then((m) => m.CashPage),
      },
      {
        path: 'ventas',
        title: `Ventas · ${TITLE}`,
        loadComponent: () => import('./features/pos/sales/sales-page').then((m) => m.SalesPage),
      },
      {
        path: 'negocios',
        title: `Negocios · ${TITLE}`,
        canMatch: [roleGuard('superadmin')],
        loadComponent: () =>
          import('./features/businesses/businesses-page').then((m) => m.BusinessesPage),
      },
      {
        path: 'usuarios',
        title: `Usuarios · ${TITLE}`,
        canMatch: [roleGuard('superadmin', 'admin')],
        loadComponent: () => import('./features/users/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'productos',
        title: `Productos · ${TITLE}`,
        canMatch: [roleGuard('superadmin', 'admin')],
        loadComponent: () =>
          import('./features/catalog/products/products-page').then((m) => m.ProductsPage),
      },
      {
        path: 'categorias',
        title: `Categorías · ${TITLE}`,
        canMatch: [roleGuard('superadmin', 'admin')],
        loadComponent: () =>
          import('./features/catalog/categories/categories-page').then((m) => m.CategoriesPage),
      },
      {
        path: 'almacen',
        canMatch: [roleGuard('superadmin', 'admin')],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'existencias' },
          {
            path: 'existencias',
            title: `Existencias · ${TITLE}`,
            loadComponent: () =>
              import('./features/inventory/stock/stock-page').then((m) => m.StockPage),
          },
          {
            path: 'entradas',
            title: `Entradas de mercancía · ${TITLE}`,
            loadComponent: () =>
              import('./features/inventory/purchases/purchases-page').then((m) => m.PurchasesPage),
          },
          {
            path: 'entradas/nueva',
            title: `Nueva entrada · ${TITLE}`,
            loadComponent: () =>
              import('./features/inventory/purchases/purchase-entry-page').then(
                (m) => m.PurchaseEntryPage,
              ),
          },
          {
            path: 'movimientos',
            title: `Movimientos · ${TITLE}`,
            loadComponent: () =>
              import('./features/inventory/movements/movements-page').then((m) => m.MovementsPage),
          },
        ],
      },
      {
        path: 'proveedores',
        title: `Proveedores · ${TITLE}`,
        canMatch: [roleGuard('superadmin', 'admin')],
        loadComponent: () =>
          import('./features/catalog/suppliers/suppliers-page').then((m) => m.SuppliersPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
