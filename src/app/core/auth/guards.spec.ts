import { TestBed } from '@angular/core/testing';
import { type CanMatchFn, provideRouter, Router, type UrlTree } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './guards';

function sessionAs(role: string) {
  localStorage.setItem(
    'pos.session',
    JSON.stringify({
      token: 't',
      user: { id: 'u', name: 'X', username: 'x', role, businessId: 'b' },
      business: null,
    }),
  );
}

function run(guard: CanMatchFn, path = 'usuarios') {
  return TestBed.runInInjectionContext(() =>
    guard({ path }, [{ path, parameters: {} } as never], {} as never),
  ) as boolean | UrlTree;
}

const asUrl = (result: boolean | UrlTree) =>
  typeof result === 'boolean' ? result : TestBed.inject(Router).serializeUrl(result);

describe('guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });
  afterEach(() => localStorage.clear());

  const setup = () => TestBed.configureTestingModule({ providers: [provideRouter([])] });

  it('authGuard sin sesión manda a login con redirect', () => {
    setup();
    expect(asUrl(run(authGuard))).toBe('/login?redirect=%2Fusuarios');
  });

  it('authGuard con sesión permite', () => {
    sessionAs('employee');
    setup();
    expect(run(authGuard)).toBe(true);
  });

  it('guestGuard con sesión manda al inicio', () => {
    sessionAs('admin');
    setup();
    expect(asUrl(run(guestGuard, 'login'))).toBe('/inicio');
  });

  it('roleGuard permite roles listados y redirige a los demás', () => {
    sessionAs('employee');
    setup();
    // El inicio del empleado es la pantalla de venta.
    expect(asUrl(run(roleGuard('admin', 'superadmin')))).toBe('/venta');

    TestBed.resetTestingModule();
    sessionAs('admin');
    setup();
    expect(run(roleGuard('admin', 'superadmin'))).toBe(true);
  });
});
