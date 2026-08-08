import { useState, type FormEvent } from 'react';
import { Fingerprint } from 'lucide-react';
import { getErrorMessage } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getEmailFromToken, useAuthStore } from '../../store/authStore';
import { useLogin } from './hooks/useAuth';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [touchIdError, setTouchIdError] = useState<string | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const email = getEmailFromToken(accessToken);
  const login = useLogin();

  async function handleTouchId() {
    setTouchIdError(null);
    try {
      const ok = await window.electronApi?.touchId.prompt('Déverrouiller Wallet Dashboard');
      if (ok) onUnlock();
      else setTouchIdError('Échec de la vérification Touch ID — utilisez votre mot de passe.');
    } catch {
      setTouchIdError('Touch ID indisponible — utilisez votre mot de passe.');
    }
  }

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    login.mutate({ email, password }, { onSuccess: onUnlock });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
          <Fingerprint size={28} className="text-accent" />
        </div>
        <h1 className="text-base font-semibold text-text-primary">Session verrouillée</h1>
        {email && <p className="mt-1 text-xs text-text-muted">{email}</p>}

        <Button onClick={handleTouchId} className="mt-6 w-full">
          Déverrouiller avec Touch ID
        </Button>
        {touchIdError && <p className="mt-2 text-xs text-accent-3">{touchIdError}</p>}

        <form onSubmit={handlePasswordSubmit} className="mt-5 flex flex-col gap-3 text-left">
          <Input
            label="Ou avec votre mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {login.isError && <p className="text-xs text-accent-3">{getErrorMessage(login.error)}</p>}
          <Button type="submit" variant="secondary" disabled={login.isPending}>
            {login.isPending ? 'Vérification…' : 'Déverrouiller'}
          </Button>
        </form>
      </div>
    </div>
  );
}
