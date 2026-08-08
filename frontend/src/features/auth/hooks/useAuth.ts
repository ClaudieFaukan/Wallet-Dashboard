import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

export function useLogin() {
  const setToken = useAuthStore((s) => s.setToken);
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => api.auth.login(input),
    onSuccess: (data) => setToken(data.accessToken),
  });
}

export function useRegister() {
  const setToken = useAuthStore((s) => s.setToken);
  return useMutation({
    mutationFn: (input: { email: string; password: string; name: string }) =>
      api.auth.register(input),
    onSuccess: (data) => setToken(data.accessToken),
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => clear(),
  });
}
