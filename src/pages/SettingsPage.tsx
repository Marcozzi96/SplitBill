import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/auth/auth-context'
import { useUpdateUser } from '@/api/hooks/auth'
import { getApiErrorMessage } from '@/api/errors'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Impostazioni</h1>
      <Card>
        <CardHeader>
          <CardTitle>{user?.username ?? 'Utente'}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
      </Card>
      <ThemeCard />
      <UsernameCard />
      <PasswordCard />
      <Card>
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

// Selettore tema: chiaro/scuro/sistema (persistito da next-themes in localStorage).
const THEME_OPTIONS = [
  { value: 'light', label: 'Chiaro', icon: Sun },
  { value: 'dark', label: 'Scuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

function ThemeCard() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tema</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted grid grid-cols-3 rounded-lg p-1">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                'text-muted-foreground flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors',
                theme === value && 'bg-background text-foreground shadow-sm',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Cambio username: il backend richiede la password attuale e ritorna un nuovo token.
function UsernameCard() {
  const { user, login } = useAuth()
  const updateUser = useUpdateUser()
  const [username, setUsername] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    updateUser.mutate(
      { username, oldPassword },
      {
        onSuccess: (auth) => {
          login(auth)
          setUsername('')
          setOldPassword('')
          toast.success('Username aggiornato')
        },
        // 401 password errata, 409 username già in uso: messaggio dal backend.
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cambia username</CardTitle>
        <CardDescription>Attuale: {user?.username}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-username">Nuovo username</FieldLabel>
              <Input
                id="new-username"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="username-old-password">Password attuale</FieldLabel>
              <Input
                id="username-old-password"
                type="password"
                autoComplete="current-password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" className="h-11 w-full" disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Salvataggio in corso…' : 'Salva username'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

// Cambio password: il backend richiede la password attuale e ritorna un nuovo token.
function PasswordCard() {
  const { login } = useAuth()
  const updateUser = useUpdateUser()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Le nuove password non coincidono')
      return
    }
    updateUser.mutate(
      { password: newPassword, oldPassword },
      {
        onSuccess: (auth) => {
          login(auth)
          setOldPassword('')
          setNewPassword('')
          setConfirmPassword('')
          toast.success('Password aggiornata')
        },
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cambia password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="old-password">Password attuale</FieldLabel>
              <Input
                id="old-password"
                type="password"
                autoComplete="current-password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">Nuova password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">Conferma nuova password</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" className="h-11 w-full" disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Salvataggio in corso…' : 'Salva password'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
