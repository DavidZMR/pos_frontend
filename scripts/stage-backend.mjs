// Prepara build/backend para el instalador:
//   1. compila ../pos_backend (tsc)
//   2. copia dist/, package.json y package-lock.json
//   3. instala SOLO dependencias de producción (npm ci --omit=dev)
//   4. genera un .env de producción a partir de ../pos_backend/.env (Mongo + JWT)
// El backend queda fuera del asar (extraResources) y lo lanza electron/lib/backend.cjs.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendSrc = join(root, '..', 'pos_backend');
const target = join(root, 'build', 'backend');

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
cpSync(join(backendSrc, 'dist'), join(target, 'dist'), {
  recursive: true,
  filter: (file) => !file.endsWith('.map'),
});

const pkg = JSON.parse(readFileSync(join(backendSrc, 'package.json'), 'utf8'));
const runtimePkg = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  type: pkg.type,
  main: pkg.main,
  dependencies: pkg.dependencies,
};
writeFileSync(join(target, 'package.json'), `${JSON.stringify(runtimePkg, null, 2)}\n`);
cpSync(join(backendSrc, 'package-lock.json'), join(target, 'package-lock.json'));

run('npm ci --omit=dev --no-audit --no-fund', target);

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
