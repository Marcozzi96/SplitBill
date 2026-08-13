import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/auth/auth-context'

// Pagina profilo minima per lo Sprint 2 (logout).
// Update profilo e delete account arrivano con lo Sprint 7.
export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Profilo</h1>
      <Card>
        <CardHeader>
          <CardTitle>{user?.username ?? 'Utente'}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="h-11 w-full" onClick={handleLogout}>
            <LogOut />
            Esci
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
