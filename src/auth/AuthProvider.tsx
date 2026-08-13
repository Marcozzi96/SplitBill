import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TOKEN_KEY } from '@/api/client'
import { useCurrentUser } from '@/api/hooks/auth'
import { AuthContext, type AuthUser, type AuthResponse } from './auth-context'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)

  // Al reload c'è il token ma non l'utente: lo recuperiamo da /user/me.
  const meQuery = useCurrentUser(!!token && !user)
  const { refetch: refetchUser } = meQuery
  useEffect(() => {
    if (meQuery.data && !user) setUser(meQuery.data)
  }, [meQuery.data, user])

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading: !!token && !user && meQuery.isPending,
      isError: !!token && !user && meQuery.isError,
      retryFetchUser: () => refetchUser(),
      login: (auth: AuthResponse) => {
        if (auth.token) {
          localStorage.setItem(TOKEN_KEY, auth.token)
          setToken(auth.token)
        }
        if (auth.user) setUser(auth.user)
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
        queryClient.clear()
      },
    }),
    [user, token, meQuery.isPending, meQuery.isError, refetchUser, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
