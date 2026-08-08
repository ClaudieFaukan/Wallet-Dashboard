import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  displayCurrency: string;
  setDisplayCurrency: (currency: string) => void;
  /** Local app-lock via Touch ID — see LockScreen. Off by default and only
   * meaningful inside Electron on a Mac with Touch ID hardware. */
  touchIdEnabled: boolean;
  setTouchIdEnabled: (enabled: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      displayCurrency: 'EUR',
      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
      touchIdEnabled: false,
      setTouchIdEnabled: (enabled) => set({ touchIdEnabled: enabled }),
    }),
    { name: 'wallet-dashboard-ui' },
  ),
);
