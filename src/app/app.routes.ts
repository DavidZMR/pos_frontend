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
    ],
  },
  { path: '**', redirectTo: '' },
];
