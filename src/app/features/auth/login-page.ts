import { httpResource } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { toApiError, unwrap } from '../../core/api/api-types';
import { AuthStore } from '../../core/auth/auth-store';
import { ConfigService } from '../../core/config/config-service';
import { PosButton, PosIcon, PosInput } from '../../shared/ui';
import { buildIsobaths, buildRoute } from './nautical-chart';

interface Health {
  status: string;
  db: 'connected' | 'connecting' | 'disconnected' | 'disconnecting';
}

type ConnectionState = 'checking' | 'online' | 'no-db' | 'offline';

const CONNECTION_TEXT: Record<ConnectionState, string> = {
  checking: 'Conectando con el servidor…',
  online: 'Servidor y base de datos conectados',
  'no-db': 'Servidor sin acceso a la base de datos',
  offline: 'Sin conexión con el servidor',
};

@Component({
  selector: 'pos-login-page',
  imports: [FormField, PosInput, PosButton, PosIcon],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  /** Ruta a la que volver tras iniciar sesión (query param `redirect`). */
  readonly redirect = input<string>();

  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly config = inject(ConfigService);

  protected readonly isobaths = buildIsobaths();
  protected readonly route = buildRoute();

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly model = signal({ username: '', password: '' });
  protected readonly loginForm = form(this.model, (s) => {
    required(s.username, { message: 'Escribe tu usuario' });
    required(s.password, { message: 'Escribe tu contraseña' });
  });

  private readonly health = httpResource<Health>(() => `${this.config.apiUrl}/health`, {
    parse: (body) => unwrap<Health>(body),
  });

  protected readonly connection = computed<ConnectionState>(() => {
    if (this.health.isLoading() && !this.health.hasValue()) return 'checking';
    if (this.health.error()) return 'offline';
    if (!this.health.hasValue()) return 'checking';
    return this.health.value().db === 'connected' ? 'online' : 'no-db';
  });
  protected readonly connectionText = computed(() => CONNECTION_TEXT[this.connection()]);

  constructor() {
    // Revisa la conexión cada 10 s mientras el login está abierto.
    const timer = setInterval(() => this.health.reload(), 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected signIn(): void {
    this.errorMessage.set('');
    void submit(this.loginForm, async () => {
      this.submitting.set(true);
      try {
        const { username, password } = this.model();
        await this.auth.login(username.trim(), password);
        const redirect = this.redirect();
        await this.router.navigateByUrl(redirect?.startsWith('/') ? redirect : this.auth.homeUrl());
      } catch (error) {
        this.errorMessage.set(toApiError(error).message);
        this.model.update((m) => ({ ...m, password: '' }));
        // La alerta ya explica el problema; no marcar la contraseña vacía como error.
        this.loginForm.password().reset();
      } finally {
        this.submitting.set(false);
      }
      return undefined;
    });
  }
}
