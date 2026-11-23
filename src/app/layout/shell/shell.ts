import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CashSessionStore } from '../../features/pos/cash-session-store';
import { sessionFolio } from '../../features/pos/pos-models';
import { ROLE_LABELS } from '../../core/auth/auth-models';
import { AuthStore } from '../../core/auth/auth-store';
import { BusinessContext } from '../../core/business/business-context';
import { ConfigService } from '../../core/config/config-service';
import { ChangePasswordDialog } from '../../features/account/change-password-dialog';
import { DialogService } from '../../shared/ui/dialog/dialog-service';
import { PosIcon } from '../../shared/ui/icon/icon';
import { PosDeviceStatus } from '../device-status';
import { NAV } from '../nav';

@Component({
  selector: 'pos-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PosIcon, PosDeviceStatus],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '(document:keydown.escape)': 'closeNav()' },
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  protected readonly context = inject(BusinessContext);
  protected readonly config = inject(ConfigService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  protected readonly cashSession = inject(CashSessionStore);

  protected readonly navOpen = signal(false);

  /** Rutas con `data: { fullBleed: true }` (la caja) usan todo el ancho y alto, sin márgenes. */
  protected readonly fullBleed = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.isFullBleed()),
    ),
    { initialValue: this.isFullBleed() },
  );

  protected readonly sessionChip = computed(() => {
    const session = this.cashSession.current();
    return session ? `Caja ${sessionFolio(session.folio)}` : '';
  });

  private isFullBleed(): boolean {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data['fullBleed'] === true;
  }

  protected readonly groups = computed(() => {
    const role = this.auth.role();
    if (!role) return [];
    return NAV.map((group) => ({
      label: group.label,
      items: group.items.filter((item) => item.roles.includes(role)),
    })).filter((group) => group.items.length > 0);
  });

  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });

  protected readonly initials = computed(() =>
    (this.auth.user()?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  protected selectBusiness(id: string): void {
    this.context.select(id || null);
  }

  protected changePassword(): void {
    this.dialogs.open(ChangePasswordDialog, { size: 'sm' });
  }

  protected logout(): void {
    this.auth.logout();
  }
}
