import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useRegister } from '@/api/hooks/auth'
import { getApiErrorMessage } from '@/api/errors'
import GoogleLoginButton from '@/components/GoogleLoginButton'

export default function RegisterPage() {
  const registerMutation = useRegister()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    registerMutation.mutate(
      { username, email, password },
      {
        onSuccess: () => setRegistered(true),
        // 400: username/email già usati — il messaggio arriva dal backend.
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <MailCheck className="text-primary mx-auto size-10" />
            <CardTitle className="text-xl">Controlla la tua email</CardTitle>
            <CardDescription>
              Ti abbiamo inviato un link di conferma. Aprilo per attivare l'account, poi accedi.
            </CardDescription>
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
          <CardTitle className="text-xl">Crea il tuo account</CardTitle>
          <CardDescription>Registrati per iniziare a dividere le spese</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" className="h-11 w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? 'Registrazione in corso…' : 'Registrati'}
              </Button>
              {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="bg-border h-px flex-1" />
                    <span className="text-muted-foreground text-xs uppercase">oppure</span>
                    <div className="bg-border h-px flex-1" />
                  </div>
                  <GoogleLoginButton onError={setError} />
                </>
              )}
              <p className="text-muted-foreground text-center text-sm">
                Hai già un account?{' '}
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                  Accedi
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
