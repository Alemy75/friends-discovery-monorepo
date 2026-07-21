import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useService } from '../lib/di/react';

export function useAuth() {
  const authService = useService((c) => c.authService);
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.currentUser(),
    retry: false,
    staleTime: 30_000,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => qc.setQueryData(['me'], null),
  });

  return {
    user: meQuery.data ?? undefined,
    isLoading: meQuery.isLoading,
    isAuthenticated: !!meQuery.data,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
  };
}
