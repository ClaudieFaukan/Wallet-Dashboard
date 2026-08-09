#!/usr/bin/env node
// Stages an isolated, production-only copy of the backend for packaging.
// Rebuilds native modules (bcrypt) against Electron's ABI in this copy only —
// backend/node_modules stays untouched so dev/`npm test` keep using the
// system-Node build. See electron/src/main.ts (spawnBackend) for how the
// packaged app consumes this at Resources/backend/.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const backendDir = path.join(rootDir, 'backend');
const stageDir = path.join(rootDir, 'build', 'backend-prod');

console.log(`Staging production backend copy at ${stageDir}...`);
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

cpSync(path.join(backendDir, 'dist'), path.join(stageDir, 'dist'), { recursive: true });

// @wallet-dashboard/shared is a type-only import in backend (erased at
// compile time, see MEMORY notes) — it's still listed as a dependency for
// workspace typechecking, but a plain `npm install` outside the workspace
// can't resolve it from the real registry. Strip it for this standalone copy.
const backendPkg = JSON.parse(readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
delete backendPkg.dependencies?.['@wallet-dashboard/shared'];
writeFileSync(path.join(stageDir, 'package.json'), JSON.stringify(backendPkg, null, 2));

const envPath = path.join(backendDir, '.env');
if (existsSync(envPath)) {
  cpSync(envPath, path.join(stageDir, '.env'));
} else {
  console.warn('Warning: backend/.env not found — the packaged app will have no env vars configured.');
}

console.log('Installing production dependencies in the staged copy...');
execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
  cwd: stageDir,
  stdio: 'inherit',
});

console.log("Rebuilding native modules (bcrypt) for Electron's ABI...");
const electronVersion = JSON.parse(
  readFileSync(path.join(rootDir, 'node_modules/electron/package.json'), 'utf8'),
).version;

execFileSync(
  path.join(rootDir, 'node_modules/.bin/electron-rebuild'),
  ['--module-dir', stageDir, '--force', '--version', electronVersion, '--only', 'bcrypt'],
  { cwd: rootDir, stdio: 'inherit' },
);

console.log(`Backend staged successfully at ${stageDir}`);
