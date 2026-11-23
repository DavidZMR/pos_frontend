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

El empaquetado a `.exe` (Electron + electron-builder) se agrega en fases posteriores.

Las convenciones del proyecto están en [`CLAUDE.md`](CLAUDE.md).
