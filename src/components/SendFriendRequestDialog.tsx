import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage } from '@/api/errors'
import { useSendFriendshipRequest } from '@/api/hooks/friends'

// Dialog "nuova richiesta di amicizia": usato dalla pagina Amici e dal FAB
// contestuale quando ci si trova su /friends.
export default function SendFriendRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const sendMutation = useSendFriendshipRequest()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    sendMutation.mutate(
      { name, message },
      {
        onSuccess: () => {
          toast.success('Richiesta inviata')
          setName('')
          setMessage('')
          onOpenChange(false)
        },
        // 400: già amici o richiesta già pendente — il messaggio arriva dal backend.
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova richiesta di amicizia</DialogTitle>
          <DialogDescription>Inserisci username o email della persona da aggiungere.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="friendName">Username o email</FieldLabel>
              <Input
                id="friendName"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="friendMessage">Messaggio</FieldLabel>
              <Input
                id="friendMessage"
                required
                placeholder="Ciao, sono io!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={sendMutation.isPending}>
                {sendMutation.isPending ? 'Invio in corso…' : 'Invia richiesta'}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
