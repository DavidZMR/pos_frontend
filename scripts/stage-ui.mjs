// Copia el build de Angular a electron/ui (lo empaqueta electron-builder dentro del asar).
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'dist', 'pos-frontend', 'browser');
const target = join(root, 'electron', 'ui');

if (!existsSync(join(source, 'index.html'))) {
  console.error(`No existe el build de Angular en ${source}. Ejecuta "ng build" primero.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true, filter: (file) => !file.endsWith('.map') });
console.log(`UI copiada a ${target}`);
