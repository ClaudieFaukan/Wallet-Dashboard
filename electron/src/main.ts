import { app, BrowserWindow, ipcMain, systemPreferences } from 'electron';
import path from 'node:path';

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
    void win.loadFile(path.join(import.meta.dirname, '../../frontend/dist/index.html'));
  }
}

void app.whenReady().then(() => {
  registerTouchIdHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
