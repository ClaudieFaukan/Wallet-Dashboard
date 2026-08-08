import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useLogin, useRegister } from './hooks/useAuth';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const login = useLogin();
  const register = useRegister();
  const mutation = mode === 'login' ? login : register;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const onSuccess = () => navigate('/', { replace: true });
    if (mode === 'login') {
      login.mutate({ email, password }, { onSuccess });
    } else {
      register.mutate({ email, password, name }, { onSuccess });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-surface p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
            W
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Wallet Dashboard</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <Input
              label="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {mutation.isError && (
            <p className="text-xs text-accent-3">{getErrorMessage(mutation.error)}</p>
          )}

          <Button type="submit" disabled={mutation.isPending} className="mt-1 w-full">
            {mutation.isPending
              ? 'Chargement…'
              : mode === 'login'
                ? 'Se connecter'
                : 'Créer le compte'}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 w-full text-center text-xs text-text-muted hover:text-text-primary"
        >
          {mode === 'login'
            ? 'Première utilisation ? Créer un compte'
            : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  );
}
