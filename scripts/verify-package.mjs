// Verifica el resultado de electron-builder antes de distribuir (lecciones de Construcciones JJ).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const unpacked = join(root, 'release', 'win-unpacked');
const resources = join(unpacked, 'resources');
const backend = join(resources, 'backend');

// serialport (báscula): el binario nativo debe ir FUERA del asar y solo el de Windows x64.
const prebuilds = join(
  resources,
  'app.asar.unpacked',
  'node_modules',
  '@serialport',
  'bindings-cpp',
  'prebuilds',
);

const checks = [
  ['Ejecutable ElAtlantico.exe', existsSync(join(unpacked, 'ElAtlantico.exe'))],
  ['app.asar (UI + proceso principal)', existsSync(join(resources, 'app.asar'))],
  [
    'serialport: binario nativo win32-x64 fuera del asar',
    existsSync(join(prebuilds, 'win32-x64', '@serialport+bindings-cpp.node')),
  ],
  [
    'serialport: sin binarios de otras plataformas',
    existsSync(prebuilds) && readdirSync(prebuilds).join() === 'win32-x64',
  ],
  ['backend/dist/server.js', existsSync(join(backend, 'dist', 'server.js'))],
  [
    'backend/package.json con "type": "module"',
    (() => {
      try {
        return JSON.parse(readFileSync(join(backend, 'package.json'), 'utf8')).type === 'module';
      } catch {
        return false;
      }
    })(),
  ],
  ...['express', 'mongoose', 'dotenv', 'zod', 'jsonwebtoken', 'bcryptjs'].map((dep) => [
    `backend/node_modules/${dep}`,
    existsSync(join(backend, 'node_modules', dep)),
  ]),
  ['backend sin dependencias de desarrollo', !existsSync(join(backend, 'node_modules', 'vitest'))],
  [
    'backend/.env con MONGODB_URI y JWT_SECRET',
    (() => {
      try {
        const env = readFileSync(join(backend, '.env'), 'utf8');
        return /^MONGODB_URI=.+/m.test(env) && /^JWT_SECRET=.{32,}/m.test(env);
      } catch {
        return false;
      }
    })(),
  ],
];

let ok = true;
for (const [name, passed] of checks) {
  console.log(`${passed ? '✔' : '✘'} ${name}`);
  if (!passed) ok = false;
}

const installer = existsSync(join(root, 'release'))
  ? readdirSync(join(root, 'release')).find((file) => file.endsWith('.exe'))
  : undefined;
if (installer) {
  const size = statSync(join(root, 'release', installer)).size / 1024 / 1024;
  console.log(`Instalador: release/${installer} (${size.toFixed(1)} MB)`);
}

if (!ok) {
  console.error('\nEl paquete NO está listo para distribuirse.');
  process.exit(1);
}
console.log('\nPaquete verificado.');
