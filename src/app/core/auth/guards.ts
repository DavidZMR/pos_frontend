import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { Router } from '@angular/router';
import type { Role } from './auth-models';
import { AuthStore } from './auth-store';

/** Requiere sesión; si no hay, manda al login recordando a dónde quería ir. */
export const authGuard: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthStore);
  if (auth.isAuthenticated()) return true;
  const redirect = `/${segments.map((s) => s.path).join('/')}`;
  return inject(Router).createUrlTree(['/login'], {
    queryParams: redirect !== '/' ? { redirect } : {},
  });
};

/** El login solo se muestra sin sesión. */
export const guestGuard: CanMatchFn = () => {
  const auth = inject(AuthStore);
  return auth.isAuthenticated() ? inject(Router).parseUrl(auth.homeUrl()) : true;
};

/**
 * Restringe por rol. La UI oculta; el backend es quien realmente decide.
 *   { path: 'negocios', canMatch: [roleGuard('superadmin')], … }
 */
export function roleGuard(...roles: Role[]): CanMatchFn {
  return () => {
    const auth = inject(AuthStore);
    return auth.hasRole(...roles) ? true : inject(Router).parseUrl(auth.homeUrl());
  };
}
