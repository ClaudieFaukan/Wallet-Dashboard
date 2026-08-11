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

interface TokenPayload {
  email?: string;
  isDemo?: boolean;
}

/** Decodes the JWT payload client-side — the token carries `sub`/`email`/`isDemo` and
 * there is no `/auth/me` route. Not used for anything security-sensitive: the backend
 * (requireAuth) is what actually enforces the demo account's restrictions, this is
 * purely to drive display (sidebar email, greying out demo-unavailable UI). */
function decodeToken(token: string | null): TokenPayload | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as TokenPayload;
  } catch {
    return null;
  }
}

export function getEmailFromToken(token: string | null): string | null {
  return decodeToken(token)?.email ?? null;
}

export function getIsDemoFromToken(token: string | null): boolean {
  return decodeToken(token)?.isDemo ?? false;
}
