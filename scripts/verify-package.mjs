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
  [
    'backend en un solo archivo (server.cjs, > 1 MB con sus dependencias)',
    existsSync(join(backend, 'server.cjs')) &&
      statSync(join(backend, 'server.cjs')).size > 1_000_000,
  ],
  [
    'backend sin node_modules ni dist (nada de miles de archivos)',
    !existsSync(join(backend, 'node_modules')) && !existsSync(join(backend, 'dist')),
  ],
  [
    'backend con lo esencial: express, mongoose, bcryptjs, jsonwebtoken, dotenv, zod',
    (() => {
      try {
        const code = readFileSync(join(backend, 'server.cjs'), 'utf8');
        return [
          'node_modules/express/',
          'node_modules/mongoose/',
          'node_modules/bcryptjs/',
          'node_modules/jsonwebtoken/',
          'node_modules/dotenv/',
          'node_modules/zod/',
        ].every((dep) => code.includes(dep));
      } catch {
        return false;
      }
    })(),
  ],
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
