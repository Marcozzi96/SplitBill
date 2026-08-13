import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-context'

// Route guard: le pagine protette richiedono un token.
// Senza token → /login (con la rotta di provenienza per il redirect post-login).
export default function RequireAuth() {
  const { token, isLoading, isError, retryFetchUser } = useAuth()
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-muted-foreground">
          Impossibile caricare i dati utente. Controlla la connessione e riprova.
        </p>
        <Button onClick={retryFetchUser}>Riprova</Button>
      </div>
    )
  }

  return <Outlet />
}
