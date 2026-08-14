import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { queryClient } from '../../../lib/queryClient';
import { useAuthStore } from '../../../store/authStore';

// Query keys aren't scoped by user id, so switching accounts within the same SPA
// session (e.g. real account -> demo account) without a full page reload would
// otherwise keep serving the previous account's cached data until each query's
// staleTime expired — clearing here guarantees a clean slate per session.
export function useLogin() {
  const setToken = useAuthStore((s) => s.setToken);
  return useMutation({
    mutationFn: (input: { email: string; password: string; rememberMe?: boolean }) =>
      api.auth.login(input),
    onSuccess: (data) => {
      queryClient.clear();
      setToken(data.accessToken);
    },
  });
}

export function useRegister() {
  const setToken = useAuthStore((s) => s.setToken);
  return useMutation({
    mutationFn: (input: { email: string; password: string; name: string }) =>
      api.auth.register(input),
    onSuccess: (data) => {
      queryClient.clear();
      setToken(data.accessToken);
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      queryClient.clear();
      clear();
    },
  });
}
