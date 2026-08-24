import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/auth/auth-context'
import { useDeleteUser, useUpdateUser } from '@/api/hooks/auth'
import { useMySettlements } from '@/api/hooks/balance'
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
      <DeleteAccountCard />
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
// Utenti creati via Google (hasPassword === false): nessuna password da verificare.
function UsernameCard() {
  const { user, login } = useAuth()
  const updateUser = useUpdateUser()
  const [username, setUsername] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const hasPassword = user?.hasPassword !== false

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    updateUser.mutate(
      hasPassword ? { username, oldPassword } : { username },
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
            {hasPassword && (
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
            )}
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

// Eliminazione account: il backend anonimizza i dati (operazione definitiva).
// Su successo: logout e ritorno alla pagina di login.
function DeleteAccountCard() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const deleteUser = useDeleteUser()
  const settlementsQuery = useMySettlements()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const openSettlements = settlementsQuery.data?.length ?? 0
  const confirmMatches = confirmText.trim().toUpperCase() === 'ELIMINA'

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setConfirmText('')
      setError(null)
    }
  }

  function handleDelete() {
    setError(null)
    deleteUser.mutate(undefined, {
      onSuccess: () => {
        logout()
        toast.success('Account eliminato')
        navigate('/login', { replace: true })
      },
      onError: (err) => setError(getApiErrorMessage(err)),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Elimina account</CardTitle>
        <CardDescription>
          I tuoi dati saranno anonimizzati. Le spese nei gruppi resteranno visibili come
          &quot;UtenteEliminato&quot;. L&apos;operazione è definitiva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" className="h-11 w-full" onClick={() => setOpen(true)}>
          Elimina account
        </Button>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Elimina account</DialogTitle>
              <DialogDescription>
                Eliminare definitivamente il tuo account? I tuoi dati saranno anonimizzati e le tue
                spese resteranno visibili come &quot;UtenteEliminato&quot;.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <FieldGroup>
                {openSettlements > 0 && (
                  <FieldError>
                    Hai ancora {openSettlements}{' '}
                    {openSettlements === 1 ? 'debito o credito aperto' : 'debiti o crediti aperti'}:
                    resteranno visibili agli altri come &quot;UtenteEliminato&quot;.
                  </FieldError>
                )}
                <Field>
                  <FieldLabel htmlFor="deleteConfirm">
                    Scrivi ELIMINA per confermare
                  </FieldLabel>
                  <Input
                    id="deleteConfirm"
                    autoComplete="off"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                </Field>
                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Annulla
              </Button>
              <Button
                variant="destructive"
                disabled={!confirmMatches || deleteUser.isPending}
                onClick={handleDelete}
              >
                {deleteUser.isPending ? 'Eliminazione in corso…' : 'Elimina'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// Cambio password: il backend richiede la password attuale e ritorna un nuovo token.
// Utenti creati via Google (hasPassword === false): prima impostazione, senza password attuale.
function PasswordCard() {
  const { user, login } = useAuth()
  const updateUser = useUpdateUser()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const hasPassword = user?.hasPassword !== false

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Le nuove password non coincidono')
      return
    }
    updateUser.mutate(
      hasPassword ? { password: newPassword, oldPassword } : { password: newPassword },
      {
        onSuccess: (auth) => {
          login(auth)
          setOldPassword('')
          setNewPassword('')
          setConfirmPassword('')
          toast.success(hasPassword ? 'Password aggiornata' : 'Password impostata')
        },
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{hasPassword ? 'Cambia password' : 'Imposta password'}</CardTitle>
        {!hasPassword && (
          <CardDescription>
            Il tuo account è stato creato con Google: imposta una password per poter accedere anche
            con email e password.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {hasPassword && (
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
            )}
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
