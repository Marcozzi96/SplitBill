import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useForgotPassword } from '@/api/hooks/auth'
import { getApiErrorMessage } from '@/api/errors'

export default function ForgotPasswordPage() {
  const forgotMutation = useForgotPassword()

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    forgotMutation.mutate(
      { email },
      {
        // Il backend risponde sempre 200 per non rivelare se l'email esiste.
        onSuccess: () => setSent(true),
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <MailCheck className="text-primary mx-auto size-10" />
            <CardTitle className="text-xl">Controlla la tua email</CardTitle>
            <CardDescription>
              Se l'indirizzo è registrato, riceverai a breve un link per reimpostare la password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link to="/login" />} nativeButton={false} className="h-11 w-full">
              Torna al login
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
          <CardTitle className="text-xl">Password dimenticata</CardTitle>
          <CardDescription>
            Inserisci la tua email: ti invieremo un link per reimpostare la password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
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
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" className="h-11 w-full" disabled={forgotMutation.isPending}>
                {forgotMutation.isPending ? 'Invio in corso…' : 'Invia link di reset'}
              </Button>
              <p className="text-muted-foreground text-center text-sm">
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                  Torna al login
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
