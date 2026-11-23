# pos_frontend

UI del punto de venta (Angular) y shell de escritorio (Electron). Lee también `../CLAUDE.md` (reglas de dinero, roles, flujo Git). Para código Angular usa la skill `angular-developer`; para componentes visuales, `pos-ui-kit` y `frontend-design`.

## Stack
Angular 22 (standalone, zoneless, OnPush por defecto, Signal Forms) · TypeScript 6 (lo fija Angular) · SCSS · Angular CDK (overlay, dialog, a11y — **sin** estilos de Material) · Chart.js (wrapper propio `pos-chart`) · ExcelJS (import dinámico) · Vitest · Electron + electron-builder (NSIS) · serialport (báscula).

## Comandos
| Comando | Qué hace |
|---|---|
| `npm start` | `ng serve` en http://localhost:4200 (usa el backend de `../pos_backend` con `npm run dev`) |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:electron` | Pruebas del proceso principal de Electron (báscula) con `node --test` |
| `npm run build` | Build de producción |
| `npx ng generate component|service|pipe|guard ...` | Generar código con el CLI (siempre) |
| `npm run electron:dev` | App de escritorio contra `ng serve` + backend dev |
| `npm run dist` | Instalador `release/PuntoVenta-Setup-x.y.z.exe` (ver skill `pos-packaging`) |

## Estructura
```
src/app/
  core/          auth (signals), interceptores (auth, business-context, errores), guards (authGuard, roleGuard con canMatch), ConfigService (apiUrl)
  shared/ui/     componentes pos-* reutilizables (ver skill pos-ui-kit)
  shared/pipes/  money, qty
  shared/utils/  money.ts, qty.ts, normalize.ts (idénticos a los del backend)
  layout/        app-shell, sidebar por rol, topbar
  features/<x>/  pantallas por dominio, rutas lazy (pos, products, purchases, inventory, sales, reports, dashboard, users, businesses, settings)
src/styles/      tokens.scss (paleta y escalas), base, utilidades
electron/        main, preload (contextBridge), lanzador de backend, config por PC, hardware/scale, hardware/printer
scripts/         stage-backend, verificación de empaquetado
```

## Reglas del proyecto
- **Un solo origen del API**: `ConfigService.apiUrl` (en Electron viene de `window.pos.config`, en navegador de `public/config.json`/default). Nunca URLs hardcodeadas en servicios.
- Dinero: el API manda/recibe centavos enteros. Mostrar con `MoneyPipe`, capturar con `pos-money-input` (emite centavos). Cantidades con `QtyPipe` / `pos-qty-input` según `unit`.
- Estilos: solo alias de tokens (`var(--surface)`, `var(--brand)`, `var(--space-4)`… ver skill `pos-ui-kit`). **Sin degradados**, sin colores sueltos en componentes, bordes de 1px en vez de sombras pesadas, números con `tabular-nums`. Muestrario en `/kit` (solo desarrollo).
- Formularios: Signal Forms (`form`, `[formField]`, `submit`). Los controles `pos-input`/`pos-select`/`pos-toggle` implementan `FormValueControl`/`FormCheckboxControl`; los modelos nunca usan `null` (usa `''`, `0`, `false`).
- Utilidades compartidas con el backend en `shared/utils` (`decimal`, `money`, `qty`, `text`): copias idénticas de `pos_backend/src/common/utils`; formateo de pantalla en `format.ts`.
- Archivos con acentos: edítalos con el editor o Node, **no** con `Get-Content`/`-replace` de PowerShell 5.1 (rompe UTF-8).
- Antes de crear un componente visual, revisa si ya existe uno `pos-*` en `shared/ui`.
- Tablas siempre con `pos-table`; diálogos con `pos-dialog`/`ConfirmService`; avisos con `ToastService`.
- Permisos en UI: rutas con `roleGuard`, menú filtrado por rol. La UI oculta, el backend decide.
- **Pantalla nueva**: ruta lazy en `app.routes.ts` (dentro del shell, con `canMatch: [roleGuard(...)]`) + entrada en `layout/nav.ts` con los mismos roles.
- **Listados**: `httpResource(() => ({ url, params }), { parse: toPage })`; filtros como signals, búsqueda con `debounced()`, página con `linkedSignal` que vuelve a 1 al cambiar filtros; `pos-table` + clases globales `.pos-filters`, `.cell-stack`, `.row-actions`.
- **Mutaciones**: servicio `XxxApi` con `firstValueFrom(http.post/patch(...))` + `unwrap`. Formularios en diálogo (`DialogService.open`) con Signal Forms; en `submit()` devolver `serverFieldErrors(toApiError(e), { campo: form.campo })` para pintar errores del backend en cada campo.
- **Sesión**: `AuthStore` (token/usuario/negocio en signals + localStorage). El superadmin elige negocio en la barra superior (`BusinessContext`), que viaja como `x-business-id` (interceptor). 401 del API ⇒ logout automático.
- **Pantallas por negocio** (catálogo, almacén, ventas): envolver en `<pos-business-gate>` y en cada `httpResource` devolver `undefined` si `!context.scope()` (así no pide datos sin negocio y recarga al cambiar de negocio). Listas pequeñas compartidas (categorías, proveedores) en `CatalogLookups`.
- **Pruebas E2E**: backend con `npm run dev:memory -- --seed` en `pos_backend` (replica set en memoria + marisquería demo; usuarios `demo.root`/`demo.admin`/`demo.caja`, clave `Demo12345`; nunca Atlas) + `ng serve`; Playwright con la skill `webapp-testing`. Reiniciar el backend entre corridas para datos limpios. Si `ng serve` no ve archivos NUEVOS, reiniciarlo.
- **Hardware** vía `window.pos` (preload, tipos en `core/config/pos-bridge.ts`). Si no existe (navegador) o no está configurado, se degrada: peso escrito a mano, sin impresión.
  - Báscula: `ScaleStore` (signals `status`/`reading` en gramos enteros). En la captura de peso (`QtyDialog`), solo productos por **kg**: con báscula conectada el campo sigue la lectura y solo agrega con peso **estable**; si el cajero escribe, manda lo escrito (`weighed: false`). Sin báscula: se escribe el peso. **Nunca** un modo simulado en la app.
  - Configuración por PC en `/equipo` (admin). Lógica serial en `electron/lib/scale/`, probada con `npm run test:electron` (`SerialPortMock`).
  - Impresora: `PrinterStore` (`ready` = configurada **e** instalada en Windows). Tickets como HTML puro en `features/pos/ticket/ticket-html.ts` (escapar todo dato; 58/80 mm, negro); `TicketPrinter` los imprime (venta con F9 o automático, reimpresión, corte). Si no hay impresora, no se ofrece imprimir.
  - Datos del ticket (nombre, RFC, dirección, encabezado, pie) en `/equipo` → `PATCH /businesses/current`, con vista previa en `<iframe sandbox="">`.
- Textos de UI en español.

---

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection
