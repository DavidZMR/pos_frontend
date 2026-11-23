import { isDevMode } from '@angular/core';
import type { Routes } from '@angular/router';

export const routes: Routes = [
  ...(isDevMode()
    ? [
        {
          path: 'kit',
          title: 'Sistema de diseño · PuntoVenta',
          loadComponent: () => import('./features/ui-kit/ui-kit-page').then((m) => m.UiKitPage),
        },
      ]
    : []),
  { path: '', pathMatch: 'full', redirectTo: 'kit' },
];
