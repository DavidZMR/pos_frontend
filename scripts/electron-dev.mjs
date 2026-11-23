// Abre Electron contra los servidores de desarrollo:
//   1) pos_backend: npm run dev   (http://127.0.0.1:3000)
//   2) pos_frontend: npm start    (http://localhost:4200)
//   3) pos_frontend: npm run electron:dev
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const electronBinary = createRequire(import.meta.url)('electron');

const env = {
  ...process.env,
  POS_DEV_SERVER_URL: process.env.POS_DEV_SERVER_URL ?? 'http://localhost:4200',
  POS_API_URL: process.env.POS_API_URL ?? 'http://127.0.0.1:3000/api',
};
// Si se hereda (p. ej. terminal de VS Code), Electron arrancaría como Node puro.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [join(root, 'electron')], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
