import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../client'
import type { components } from '../types'

type AuthRequest = components['schemas']['AuthRequest']
type AuthResponse = components['schemas']['AuthResponse']
type UserDTO = components['schemas']['UserDTO']
type ForgotPasswordRequest = components['schemas']['ForgotPasswordRequest']
type ResetPasswordRequest = components['schemas']['ResetPasswordRequest']

// Utente autenticato corrente (idratazione del contesto al reload).
export function useCurrentUser(enabled: boolean) {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => (await api.get<UserDTO>('/user/me')).data,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: async (credentials: AuthRequest) =>
      (await api.post<AuthResponse>('/auth/login', credentials)).data,
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: Required<Pick<AuthRequest, 'username' | 'email' | 'password'>>) =>
      (await api.post<string>('/auth/register', data)).data,
  })
}

export function useConfirmEmail(token: string | null) {
  return useQuery({
    queryKey: ['confirmEmail', token],
    queryFn: async () =>
      (await api.get<UserDTO>('/auth/confirmEmail', { params: { token } })).data,
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (data: ForgotPasswordRequest) =>
      (await api.post<string>('/auth/forgotPassword', data)).data,
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (data: ResetPasswordRequest) =>
      (await api.post<string>('/auth/resetPassword', data)).data,
  })
}
