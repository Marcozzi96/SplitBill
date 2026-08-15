import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import FriendPicker from '@/components/FriendPicker'
import { getApiErrorMessage } from '@/api/errors'
import { useFriends } from '@/api/hooks/friends'
import { useCreateGroup, useGroups } from '@/api/hooks/groups'

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function GroupsPage() {
  const [page, setPage] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const groupsQuery = useGroups(page)

  if (groupsQuery.isPending) {
    return (
      <div className="flex justify-center py-12">
        <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (groupsQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(groupsQuery.error)}</p>
        <Button variant="outline" onClick={() => groupsQuery.refetch()}>
          Riprova
        </Button>
      </div>
    )
  }

  const groups = groupsQuery.data?.content ?? []
  const totalPages = groupsQuery.data?.totalPages ?? 1

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gruppi</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Users />
          Nuovo gruppo
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          Nessun gruppo ancora: crea il primo.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <Link key={group.groupId} to={`/groups/${group.groupId}`} className="block">
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="py-3">
                  <p className="font-medium">{group.name}</p>
                  {group.description && (
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {group.description}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Creato il {formatDate(group.creationDate)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Precedenti
          </Button>
          <span className="text-muted-foreground text-sm">
            Pagina {page + 1} di {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Successivi
          </Button>
        </div>
      )}

      <CreateGroupDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

// --- Dialog: creazione gruppo (nome, descrizione, selezione amici) ---

function CreateGroupDialog({
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
        <form onSubmit={handleSubmit}>
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
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creazione in corso…' : 'Crea gruppo'}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
