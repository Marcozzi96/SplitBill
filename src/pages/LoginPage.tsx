import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useLogin } from '@/api/hooks/auth'
import { getApiErrorMessage } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const loginMutation = useLogin()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    // Il backend accetta username O email: si distingue dalla presenza di '@'.
    const credentials = identifier.includes('@')
      ? { email: identifier, password }
      : { username: identifier, password }
    loginMutation.mutate(credentials, {
      onSuccess: (auth) => {
        login(auth)
        navigate(from, { replace: true })
      },
      onError: (err) => setError(getApiErrorMessage(err)),
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Accedi a SplitBill</CardTitle>
          <CardDescription>Inserisci le tue credenziali per continuare</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">Username o email</FieldLabel>
                <Input
                  id="identifier"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" className="h-11 w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? 'Accesso in corso…' : 'Accedi'}
              </Button>
              <p className="text-muted-foreground text-center text-sm">
                <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
                  Password dimenticata?
                </Link>
              </p>
              <p className="text-muted-foreground text-center text-sm">
                Non hai un account?{' '}
                <Link to="/register" className="text-primary underline-offset-4 hover:underline">
                  Registrati
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
