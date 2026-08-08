import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { LockScreen } from './LockScreen';

type BootstrapState = 'checking' | 'authenticated' | 'unauthenticated';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setToken = useAuthStore((s) => s.setToken);
  const clear = useAuthStore((s) => s.clear);
  const touchIdEnabled = useUiStore((s) => s.touchIdEnabled);
  const [bootstrap, setBootstrap] = useState<BootstrapState>(
    isAuthenticated ? 'authenticated' : 'checking',
  );
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (isAuthenticated) return;
    api.auth
      .refresh()
      .then((token) => {
        setToken(token);
        setBootstrap('authenticated');
      })
      .catch(() => {
        clear();
        setBootstrap('unauthenticated');
      });
    // Runs once on mount to silently pick up an existing refresh cookie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bootstrap === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-bg-base" />;
  }

  if (bootstrap === 'unauthenticated' || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const hasElectronTouchId = typeof window !== 'undefined' && Boolean(window.electronApi);
  if (touchIdEnabled && hasElectronTouchId && !unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return <Outlet />;
}
