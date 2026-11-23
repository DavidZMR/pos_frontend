import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { toApiError, unwrap } from '../api/api-types';
import { ConfigService } from '../config/config-service';
import { LocalStore } from '../storage';
import type { Business, Role, Session, User } from './auth-models';

const SESSION_KEY = 'pos.session';

/** Pantalla inicial según el rol. */
const HOME_BY_ROLE: Record<Role, string> = {
  superadmin: '/inicio',
  admin: '/inicio',
  // El cajero entra directo a vender.
  employee: '/venta',
};

/**
 * Sesión del usuario (token + perfil + negocio) en signals, persistida en localStorage
 * para que la caja no pida login en cada arranque del programa.
 */
@Service()
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly router = inject(Router);
  private readonly store = inject(LocalStore);

  private readonly session = signal<Session | null>(this.store.get<Session>(SESSION_KEY));

  readonly token = computed(() => this.session()?.token ?? null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly business = computed(() => this.session()?.business ?? null);
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isSuperadmin = computed(() => this.role() === 'superadmin');
  readonly homeUrl = computed(() => {
    const role = this.role();
    return role ? HOME_BY_ROLE[role] : '/login';
  });

  hasRole(...roles: Role[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  async login(username: string, password: string): Promise<void> {
    const body = await firstValueFrom(
      this.http.post(this.config.api('/auth/login'), { username, password }),
    );
    this.setSession(unwrap<Session>(body));
  }

  /**
   * Al arrancar: valida el token guardado y refresca perfil y negocio.
   * Si el servidor no responde (sin red) conserva la sesión local; si responde 401, la borra.
   */
  async restore(): Promise<void> {
    const current = this.session();
    if (!current) return;
    try {
      const body = await firstValueFrom(this.http.get(this.config.api('/auth/me')));
      const profile = unwrap<{ user: User; business: Business | null }>(body);
      this.setSession({ ...current, ...profile });
    } catch (error) {
      if (toApiError(error).status === 401) this.clear();
    }
  }

  updateBusiness(business: Business): void {
    const current = this.session();
    if (current?.business?.id === business.id) this.setSession({ ...current, business });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(this.config.api('/auth/change-password'), { currentPassword, newPassword }),
    );
  }

  logout(): void {
    this.clear();
    void this.router.navigateByUrl('/login');
  }

  private setSession(session: Session): void {
    this.session.set(session);
    this.store.set(SESSION_KEY, session);
  }

  private clear(): void {
    this.session.set(null);
    this.store.remove(SESSION_KEY);
  }
}
