import { createContext, useContext } from 'react'
import type { components } from '@/api/types'

export type AuthUser = components['schemas']['UserDTO']
export type AuthResponse = components['schemas']['AuthResponse']

export interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  /** true mentre si recupera /user/me con un token già presente (es. reload) */
  isLoading: boolean
  /** true se il recupero di /user/me è fallito (es. errore di rete) */
  isError: boolean
  retryFetchUser: () => void
  login: (auth: AuthResponse) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>')
  return ctx
}
