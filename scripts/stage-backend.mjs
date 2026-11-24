// Prepara build/backend para el instalador:
//   1. compila ../pos_backend (tsc: también verifica tipos)
//   2. empaqueta dist/server.js y TODAS sus dependencias en UN archivo (esbuild): server.cjs
//   3. genera un .env de producción a partir de ../pos_backend/.env (Mongo + JWT)
// Un solo archivo en lugar de miles en node_modules: Windows Defender revisa 1 archivo en la
// primera apertura y el backend arranca en una fracción del tiempo.
// El backend queda fuera del asar (extraResources) y lo lanza electron/lib/backend.cjs.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendSrc = join(root, '..', 'pos_backend');
const target = join(root, 'build', 'backend');

/**
 * Dependencias opcionales del driver de MongoDB (Kerberos, compresión, AWS, cifrado…): el
 * driver las carga con try/catch y no se usan con Atlas + usuario/contraseña. pino-pretty solo
 * se usa en desarrollo.
 */
const OPTIONAL_EXTERNALS = [
  'kerberos',
  '@mongodb-js/zstd',
  '@aws-sdk/credential-providers',
  'gcp-metadata',
  'snappy',
  'socks',
  'aws4',
  'mongodb-client-encryption',
  'pino-pretty',
];

const run = (command, cwd) => {
  console.log(`> ${command}  (${cwd})`);
  execSync(command, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, MONGOMS_DISABLE_POSTINSTALL: '1' },
  });
};

if (!existsSync(join(backendSrc, 'package.json'))) {
  console.error(`No se encontró pos_backend en ${backendSrc}`);
  process.exit(1);
}

const envFile = join(backendSrc, '.env');
if (!existsSync(envFile)) {
  console.error(`Falta ${envFile} (MONGODB_URI y JWT_SECRET). Copia .env.example y llénalo.`);
  process.exit(1);
}

run('npm run build', backendSrc);

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const outfile = join(target, 'server.cjs');
const result = await build({
  entryPoints: [join(backendSrc, 'dist', 'server.js')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: OPTIONAL_EXTERNALS,
  // El código fuente es ESM; en CJS `import.meta.url` no existe: se emula para las dependencias.
  define: { 'import.meta.url': 'importMetaUrl' },
  banner: { js: "const importMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
  legalComments: 'none',
  logLevel: 'warning',
  metafile: true,
  // Los paquetes se resuelven desde ../pos_backend/node_modules.
  absWorkingDir: backendSrc,
});
const inputs = Object.keys(result.metafile.inputs).length;
const sizeMb = (statSync(outfile).size / 1024 / 1024).toFixed(1);
console.log(`Backend empaquetado: ${outfile} (${sizeMb} MB, ${inputs} módulos en 1 archivo)`);

// .env de producción: solo lo necesario. PORT/HOST/CORS los define el lanzador de Electron.
const source = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!source[key]) {
    console.error(`Falta ${key} en ${envFile}`);
    process.exit(1);
  }
}
const prodEnv = [
  `MONGODB_URI=${source.MONGODB_URI}`,
  `JWT_SECRET=${source.JWT_SECRET}`,
  `JWT_EXPIRES_IN=${source.JWT_EXPIRES_IN || '12h'}`,
  'LOG_LEVEL=info',
  '',
].join('\n');
writeFileSync(join(target, '.env'), prodEnv);

console.log(`Backend listo en ${target}`);
