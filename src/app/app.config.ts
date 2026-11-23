import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth-store';
import { authInterceptor, sessionExpiredInterceptor } from './core/auth/interceptors';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor, sessionExpiredInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    // Valida la sesión guardada antes de pintar la primera pantalla.
    provideAppInitializer(() => inject(AuthStore).restore()),
  ],
};
