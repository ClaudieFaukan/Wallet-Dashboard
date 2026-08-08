/// <reference types="vite/client" />

interface ElectronApi {
  touchId: {
    isAvailable(): Promise<boolean>;
    prompt(reason: string): Promise<boolean>;
  };
}

interface Window {
  electronApi?: ElectronApi;
}
