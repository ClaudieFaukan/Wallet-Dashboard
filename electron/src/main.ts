import { app, BrowserWindow, dialog, ipcMain, session, systemPreferences } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const HEALTH_URL = `${BACKEND_URL}/api/v1/health`;

let backendProcess: ChildProcess | null = null;

function registerTouchIdHandlers() {
  ipcMain.handle('touch-id:is-available', () => {
    return process.platform === 'darwin' && systemPreferences.canPromptTouchID();
  });

  ipcMain.handle('touch-id:prompt', async (_event, reason: string) => {
    if (process.platform !== 'darwin') return false;
    try {
      await systemPreferences.promptTouchID(reason);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Spawns the backend under Electron's own Node runtime (ELECTRON_RUN_AS_NODE)
 * so the packaged app doesn't depend on a system Node install. `bcrypt`
 * (native module) must be prebuilt for Electron's ABI ahead of time for this
 * to work — see scripts/stage-backend.mjs, never done against the
 * backend/node_modules used by dev/tests. `cwd` is set to the packaged
 * backend/ resource dir so the backend's own `dotenv/config` (which reads
 * `.env` from process.cwd()) picks up the bundled .env automatically.
 */
function spawnBackend(): void {
  const backendDir = path.join(import.meta.dirname, '../../backend');
  backendProcess = spawn(process.execPath, [path.join(backendDir, 'dist/server.js')], {
    cwd: backendDir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production' },
    stdio: 'inherit',
  });

  backendProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      dialog.showErrorBox(
        'Wallet Dashboard',
        `Le serveur backend s'est arrêté de façon inattendue (code ${code}).`,
      );
    }
  });
}

async function waitForBackend(timeoutMs = 15_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) return true;
    } catch {
      // Backend not listening yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

/** Frontend and API are same-origin in prod (see backend/src/app.ts), so a
 * single strict policy covers both. Dev is left unrestricted — Vite's HMR
 * client needs a much looser policy and fighting that isn't worth it. */
function applyStrictCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'",
        ],
      },
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    void win.loadURL('http://localhost:5173');
  } else {
    void win.loadURL(BACKEND_URL);
  }
}

void app.whenReady().then(async () => {
  registerTouchIdHandlers();

  if (process.env.NODE_ENV !== 'development') {
    applyStrictCsp();
    spawnBackend();
    const ready = await waitForBackend();
    if (!ready) {
      dialog.showErrorBox('Wallet Dashboard', "Le serveur backend n'a pas démarré à temps.");
      app.quit();
      return;
    }
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  backendProcess?.kill();
});
