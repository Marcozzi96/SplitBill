import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirmEmail } from '@/api/hooks/auth'
import { getApiErrorMessage } from '@/api/errors'

// Route FE del link inviato via email: /auth/confirmEmail?token=...
// Legge il token dalla query string e chiama GET /auth/confirmEmail.
export default function ConfirmEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const confirmQuery = useConfirmEmail(token)

  let icon
  let title
  let description
  if (!token) {
    icon = <CircleX className="text-destructive mx-auto size-10" />
    title = 'Link non valido'
    description = 'Il link non contiene un token di conferma valido.'
  } else if (confirmQuery.isPending) {
    icon = <LoaderCircle className="text-muted-foreground mx-auto size-10 animate-spin" />
    title = 'Conferma in corso…'
    description = 'Stiamo verificando il tuo indirizzo email.'
  } else if (confirmQuery.isError) {
    // 400: token scaduto/usato/non valido — il messaggio arriva dal backend.
    icon = <CircleX className="text-destructive mx-auto size-10" />
    title = 'Conferma non riuscita'
    description = getApiErrorMessage(confirmQuery.error)
  } else {
    icon = <CircleCheck className="text-primary mx-auto size-10" />
    title = 'Email confermata'
    description = 'Il tuo account è attivo: ora puoi accedere.'
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          {icon}
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {!confirmQuery.isPending && (
          <CardContent>
            <Button render={<Link to="/login" />} nativeButton={false} className="h-11 w-full">
              Vai al login
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
