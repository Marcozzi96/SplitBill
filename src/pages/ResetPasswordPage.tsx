import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, CircleX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useResetPassword } from '@/api/hooks/auth'
import { getApiErrorMessage } from '@/api/errors'

// Route FE del link inviato via email: /resetPassword?token=...
// Il token è valido 15 minuti e a uso singolo.
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const resetMutation = useResetPassword()

  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setError(null)
    resetMutation.mutate(
      { token, newPassword },
      {
        onSuccess: () => setDone(true),
        // 400: token scaduto/usato/non valido — il messaggio arriva dal backend.
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CircleX className="text-destructive mx-auto size-10" />
            <CardTitle className="text-xl">Link non valido</CardTitle>
            <CardDescription>Il link non contiene un token di reset valido.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link to="/forgot-password" />} nativeButton={false} className="h-11 w-full">
              Richiedi un nuovo link
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CircleCheck className="text-primary mx-auto size-10" />
            <CardTitle className="text-xl">Password aggiornata</CardTitle>
            <CardDescription>Ora puoi accedere con la nuova password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link to="/login" />} nativeButton={false} className="h-11 w-full">
              Vai al login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Reimposta la password</CardTitle>
          <CardDescription>Scegli una nuova password per il tuo account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="newPassword">Nuova password</FieldLabel>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" className="h-11 w-full" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? 'Salvataggio in corso…' : 'Salva nuova password'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
