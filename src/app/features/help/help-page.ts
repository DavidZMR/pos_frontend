import { DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { BRAND } from '../../core/branding';
import { PosButton, PosIcon, PosPageHeader } from '../../shared/ui';
import type { IconName } from '../../shared/ui/icon/icons';

interface Topic {
  id: string;
  title: string;
  icon: IconName;
  /** Solo administradores (y superadmin); el cajero no ve esas pantallas. */
  managers?: boolean;
}

const TOPICS: readonly Topic[] = [
  { id: 'entrar', title: 'Entrar y salir', icon: 'key' },
  { id: 'abrir-caja', title: 'Abrir la caja', icon: 'power' },
  { id: 'vender', title: 'Vender', icon: 'cart' },
  { id: 'pesar', title: 'Pesar y vender por litro', icon: 'scale' },
  { id: 'cobrar', title: 'Cobrar', icon: 'wallet' },
  { id: 'corte', title: 'Entradas, retiros y corte', icon: 'lock' },
  { id: 'ventas', title: 'Consultar y cancelar ventas', icon: 'receipt' },
  { id: 'productos', title: 'Productos y precios', icon: 'package', managers: true },
  { id: 'entradas', title: 'Entradas de mercancía', icon: 'truck', managers: true },
  { id: 'existencias', title: 'Existencias y ajustes', icon: 'warehouse', managers: true },
  { id: 'reportes', title: 'Tablero y reportes', icon: 'chart', managers: true },
  { id: 'usuarios', title: 'Usuarios y equipo', icon: 'users', managers: true },
  { id: 'atajos', title: 'Atajos de teclado', icon: 'keyboard' },
  { id: 'problemas', title: 'Si algo falla', icon: 'alert' },
];

/**
 * Manual de uso dentro de la app: siempre a la mano en la caja, sin internet y con los textos de
 * esta versión. El cajero ve solo lo de la caja; el administrador, todo. Se puede imprimir.
 */
@Component({
  selector: 'pos-help-page',
  imports: [PosButton, PosIcon, PosPageHeader, RouterLink],
  templateUrl: './help-page.html',
  styleUrl: './help-page.scss',
})
export class HelpPage {
  private readonly auth = inject(AuthStore);
  private readonly document = inject(DOCUMENT);

  protected readonly brand = BRAND.name;
  protected readonly managers = computed(() => this.auth.role() !== 'employee');
  protected readonly superadmin = this.auth.isSuperadmin;
  protected readonly topics = computed(() =>
    TOPICS.filter((topic) => !topic.managers || this.managers()),
  );

  /** Número de cada tema según lo que ve este usuario (1, 2, 3…). */
  protected number(id: string): number {
    return this.topics().findIndex((t) => t.id === id) + 1;
  }

  /** Lleva al tema y le pasa el foco (lectores de pantalla y teclado siguen ahí). */
  protected go(id: string): void {
    const heading = this.document.getElementById(`${id}-titulo`);
    heading?.scrollIntoView({ block: 'start' });
    heading?.focus({ preventScroll: true });
  }

  protected print(): void {
    this.document.defaultView?.print();
  }
}
