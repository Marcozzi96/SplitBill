import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import FriendPicker from '@/components/FriendPicker'
import { getApiErrorMessage } from '@/api/errors'
import { useFriends } from '@/api/hooks/friends'
import { useCreateGroup } from '@/api/hooks/groups'

// Dialog creazione gruppo (nome, descrizione, selezione amici): usato dalla
// pagina Gruppi e dal FAB contestuale quando ci si trova su /groups.
export default function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createMutation = useCreateGroup()
  // Prima pagina di amici (20): sufficiente per la selezione in un dialog.
  const friendsQuery = useFriends(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  function toggle(userId: number) {
    setSelectedIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    createMutation.mutate(
      { name, description, memberIds: selectedIds },
      {
        onSuccess: () => {
          toast.success('Gruppo creato')
          setName('')
          setDescription('')
          setSelectedIds([])
          onOpenChange(false)
        },
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo gruppo</DialogTitle>
          <DialogDescription>
            Dai un nome al gruppo e aggiungi gli amici che ne faranno parte.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="createGroupForm" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="groupName">Nome</FieldLabel>
                <Input
                  id="groupName"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="groupDescription">Descrizione</FieldLabel>
                <Input
                  id="groupDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Membri</FieldLabel>
                <FriendPicker
                  friends={friendsQuery.data?.content ?? []}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                  emptyText="Nessun amico da aggiungere: invia prima una richiesta di amicizia."
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="submit"
            form="createGroupForm"
            className="w-full"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creazione in corso…' : 'Crea gruppo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
