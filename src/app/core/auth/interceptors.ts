import type { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast-service';
import { BusinessContext } from '../business/business-context';
import { ConfigService } from '../config/config-service';
import { AuthStore } from './auth-store';

export const BUSINESS_HEADER = 'x-business-id';

/** Agrega el token y, para superadmin, el negocio seleccionado. Solo a peticiones del API. */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const config = inject(ConfigService);
  if (!config.isApiRequest(req.url)) return next(req);

  const auth = inject(AuthStore);
  const token = auth.token();
  if (!token) return next(req);

  const setHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
  const businessId = inject(BusinessContext).headerBusinessId();
  if (businessId && !req.headers.has(BUSINESS_HEADER)) setHeaders[BUSINESS_HEADER] = businessId;

  return next(req.clone({ setHeaders }));
};

/** Si el API responde 401 con sesión activa, la sesión expiró: cerrar y volver al login. */
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const toast = inject(ToastService);
  const config = inject(ConfigService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isLogin = req.url.endsWith('/auth/login');
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isLogin &&
        config.isApiRequest(req.url) &&
        auth.isAuthenticated()
      ) {
        toast.warning('Tu sesión terminó. Vuelve a iniciar sesión.');
        auth.logout();
      }
      return throwError(() => error);
    }),
  );
};
