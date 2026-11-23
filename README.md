# pos_frontend

Interfaz del punto de venta multi-negocio (Angular 22) y aplicación de escritorio (Electron) que se instala como `.exe`.

## Requisitos
- Node.js 24+
- Backend corriendo (`../pos_backend`, `npm run dev`)

## Inicio rápido
```bash
npm install
npm start          # http://localhost:4200
```

## Scripts
| Script | Descripción |
|---|---|
| `npm start` | Servidor de desarrollo |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run build` | Build de producción |

## Aplicación de escritorio
| Script | Descripción |
|---|---|
| `npm run electron:dev` | Electron contra `npm start` y el backend en desarrollo |
| `npm run dist` | Genera `release/PuntoVenta-Setup-<versión>.exe` con el backend embebido |

El instalador incluye el backend (`../pos_backend`) y su `.env`; requiere internet para MongoDB Atlas. Registro en `%APPDATA%\PuntoVenta\logs\puntoventa.log` y configuración por PC en `%APPDATA%\PuntoVenta\config.json`.

Las convenciones del proyecto están en [`CLAUDE.md`](CLAUDE.md).
