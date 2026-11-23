import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ROLE_LABELS } from '../../core/auth/auth-models';
import { AuthStore } from '../../core/auth/auth-store';
import { BusinessContext } from '../../core/business/business-context';
import { ConfigService } from '../../core/config/config-service';
import { ChangePasswordDialog } from '../../features/account/change-password-dialog';
import { DialogService } from '../../shared/ui/dialog/dialog-service';
import { PosIcon } from '../../shared/ui/icon/icon';
import { NAV } from '../nav';

@Component({
  selector: 'pos-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PosIcon],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '(document:keydown.escape)': 'closeNav()' },
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  protected readonly context = inject(BusinessContext);
  protected readonly config = inject(ConfigService);
  private readonly dialogs = inject(DialogService);

  protected readonly navOpen = signal(false);

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
