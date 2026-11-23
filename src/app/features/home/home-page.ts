import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROLE_LABELS } from '../../core/auth/auth-models';
import { AuthStore } from '../../core/auth/auth-store';
import { BusinessContext } from '../../core/business/business-context';
import { NAV } from '../../layout/nav';
import { PosBadge, PosIcon, PosPageHeader } from '../../shared/ui';

const DESCRIPTIONS: Record<string, string> = {
  '/negocios': 'Da de alta negocios, edita sus datos y desactívalos.',
  '/usuarios': 'Crea cuentas para tu equipo y controla quién puede entrar.',
};

/** Pantalla de inicio: saludo, negocio actual y accesos a lo que el rol puede usar. */
@Component({
  selector: 'pos-home-page',
  imports: [RouterLink, PosPageHeader, PosIcon, PosBadge],
  template: `
    <pos-page-header
      [eyebrow]="roleLabel()"
      [heading]="greeting()"
      [description]="businessLine()"
    />

    @if (shortcuts().length) {
      <section class="shortcuts" aria-label="Accesos">
        @for (item of shortcuts(); track item.path) {
          <a class="shortcut" [routerLink]="item.path">
            <span class="shortcut-icon"><pos-icon [name]="item.icon" [size]="22" /></span>
            <span class="shortcut-text">
              <span class="shortcut-title">{{ item.label }}</span>
              <span class="shortcut-desc">{{ item.description }}</span>
            </span>
            <pos-icon class="shortcut-go" name="chevron-right" [size]="18" />
          </a>
        }
      </section>
    } @else {
      <section class="note">
        <pos-badge tone="brand">Próximamente</pos-badge>
        <p>La pantalla de venta estará disponible aquí muy pronto.</p>
      </section>
    }
  `,
  styles: `
    .shortcuts {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
      gap: var(--space-4);
    }
    .shortcut {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--surface-raised);
      border: var(--border);
      border-radius: var(--radius-lg);
      color: var(--ink);
      text-decoration: none;
      transition:
        border-color var(--dur-fast) var(--ease-out),
        transform var(--dur-fast) var(--ease-out);
    }
    .shortcut:hover {
      border-color: var(--brand);
      transform: translateY(-2px);
    }
    .shortcut-icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: var(--radius);
      background: var(--brand-softer);
      color: var(--brand-ink);
    }
    .shortcut-text {
      display: grid;
      gap: 2px;
      flex: 1;
    }
    .shortcut-title {
      font-family: var(--font-display);
      font-stretch: var(--display-stretch);
      font-size: var(--text-lg);
      font-weight: 650;
    }
    .shortcut-desc {
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
    .shortcut-go {
      color: var(--ink-faint);
    }
    .note {
      display: grid;
      justify-items: start;
      gap: var(--space-3);
      padding: var(--space-6);
      background: var(--surface-raised);
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-lg);
      color: var(--ink-muted);
    }
  `,
})
export class HomePage {
  private readonly auth = inject(AuthStore);
  private readonly context = inject(BusinessContext);

  protected readonly greeting = computed(() => {
    const first = this.auth.user()?.name.split(/\s+/)[0] ?? '';
    return `Hola, ${first}`;
  });

  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });

  protected readonly businessLine = computed(() => {
    const business = this.context.current();
    if (business) return `Trabajando en ${business.name}.`;
    return this.auth.isSuperadmin()
      ? 'Vista global: elige un negocio arriba para trabajar dentro de él.'
      : '';
  });

  protected readonly shortcuts = computed(() => {
    const role = this.auth.role();
    if (!role) return [];
    return NAV.flatMap((group) => group.items)
      .filter((item) => item.path !== '/inicio' && item.roles.includes(role))
      .map((item) => ({ ...item, description: DESCRIPTIONS[item.path] ?? '' }));
  });
}
