import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronApi {
  touchId: {
    /** Whether this Mac has Touch ID hardware available for the app to use. */
    isAvailable(): Promise<boolean>;
    /** Shows the native Touch ID (or password fallback) prompt. Resolves to whether it succeeded. */
    prompt(reason: string): Promise<boolean>;
  };
}

const electronApi: ElectronApi = {
  touchId: {
    isAvailable: () => ipcRenderer.invoke('touch-id:is-available') as Promise<boolean>,
    prompt: (reason: string) => ipcRenderer.invoke('touch-id:prompt', reason) as Promise<boolean>,
  },
};

contextBridge.exposeInMainWorld('electronApi', electronApi);
