import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      isAuthenticated: false,
      setToken: (token) => set({ accessToken: token, isAuthenticated: true }),
      clear: () => set({ accessToken: null, isAuthenticated: false }),
    }),
    { name: 'wallet-dashboard-auth' },
  ),
);

/** Non-reactive getter, for use outside React (axios interceptors). */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/** Decodes the JWT payload client-side to read the user's email — the token
 * only carries `sub`/`email` and there is no `/auth/me` route. Not used for
 * anything security-sensitive, purely for display in the sidebar. */
export function getEmailFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      email?: string;
    };
    return decoded.email ?? null;
  } catch {
    return null;
  }
}
