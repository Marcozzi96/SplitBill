import { useState } from 'react'
import { toast } from 'sonner'
import { LoaderCircle } from 'lucide-react'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import BillForm, { type BillFormValues } from '@/components/BillForm'
import FriendPicker from '@/components/FriendPicker'
import { getApiErrorMessage } from '@/api/errors'
import { useCreateBill } from '@/api/hooks/bills'
import { useFriends } from '@/api/hooks/friends'
import { useGroups, useGroupMembers } from '@/api/hooks/groups'
import { useAuth } from '@/auth/auth-context'
import type { components } from '@/api/types'

type GroupMemberDTO = components['schemas']['GroupMemberDTO']

const PERSONAL = 'personale'

// Creazione spesa globale (dal FAB): a differenza di CreateBillDialog il
// contesto non è dato dalla pagina ma si sceglie qui — un gruppo oppure
// "personale" (tra amici, con selezione dei partecipanti via FriendPicker).
// Dal FAB contestuale (dettaglio amico/gruppo) il contesto e gli amici
// partono preselezionati tramite le prop di default.
export default function GlobalCreateBillDialog({
  open,
  onOpenChange,
  defaultContext,
  defaultFriendIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Contesto preselezionato: assente/PERSONAL oppure id del gruppo. */
  defaultContext?: string
  /** Amici preselezionati nel contesto personale (es. dettaglio amico). */
  defaultFriendIds?: number[]
}) {
  const { user } = useAuth()
  const createMutation = useCreateBill()
  const groupsQuery = useGroups(0)
  const friendsQuery = useFriends(0)
  const [context, setContext] = useState(defaultContext ?? PERSONAL)
  const [friendIds, setFriendIds] = useState<number[]>(defaultFriendIds ?? [])
  const [error, setError] = useState<string | null>(null)

  const groupId = context === PERSONAL ? null : Number(context)
  const groups = groupsQuery.data?.content ?? []
  const friends = friendsQuery.data?.content ?? []

  // Spesa personale: partecipano l'utente corrente e gli amici selezionati.
  // A BillForm bastano userId e username del GroupMemberDTO.
  const personalMembers: GroupMemberDTO[] = [
    ...(user?.userId != null ? [{ userId: user.userId, username: user.username }] : []),
    ...friends
      .filter((f) => f.userId != null && friendIds.includes(f.userId))
      .map((f) => ({ userId: f.userId, username: f.username })),
  ]

  function toggleFriend(userId: number) {
    setFriendIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  function handleSubmit(values: BillFormValues) {
    setError(null)
    createMutation.mutate(
      {
        groupId: groupId ?? undefined,
        description: values.description,
        notes: values.notes,
        amount: values.amountCents / 100,
        buyerId: values.buyerId,
        shoppingItemIds: values.shoppingItemIds,
        shares: Object.fromEntries(
          Object.entries(values.sharesCents).map(([userId, cents]) => [userId, cents / 100]),
        ),
      },
      {
        onSuccess: () => {
          toast.success('Spesa creata')
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
          <DialogTitle>Nuova spesa</DialogTitle>
          <DialogDescription>
            Scegli il contesto, poi inserisci descrizione, importo, chi ha pagato e la
            ripartizione.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="billContext">Contesto</FieldLabel>
              <select
                id="billContext"
                className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base md:text-sm"
                value={context}
                onChange={(e) => {
                  setContext(e.target.value)
                  setError(null)
                }}
              >
                <option value={PERSONAL}>Personale (tra amici)</option>
                {groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    Gruppo: {g.name}
                  </option>
                ))}
              </select>
            </Field>

            {groupId == null && (
              <Field>
                <FieldLabel>Con chi</FieldLabel>
                <FriendPicker
                  friends={friends}
                  selectedIds={friendIds}
                  onToggle={toggleFriend}
                  emptyText="Nessun amico: aggiungine uno dalla pagina Amici."
                />
              </Field>
            )}
          </FieldGroup>

          {groupId == null ? (
            friendIds.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Seleziona almeno un amico per continuare.
              </p>
            ) : friendsQuery.isPending ? (
              // Amici preselezionati (FAB dal dettaglio amico): attendo la lista
              // per avere gli username e la preselezione corretta dei partecipanti.
              <div className="flex justify-center py-6">
                <LoaderCircle className="text-muted-foreground size-6 animate-spin" />
              </div>
            ) : (
              // La key cambia con i partecipanti: quote e selezioni ripartono da zero.
              <BillForm
                key={`personal-${friendIds.join(',')}`}
                members={personalMembers}
                formId="global-bill-form"
                submitLabel="Crea spesa"
                isPending={createMutation.isPending}
                error={error}
                onSubmit={handleSubmit}
              />
            )
          ) : (
            <GroupBillForm
              key={groupId}
              groupId={groupId}
              isPending={createMutation.isPending}
              error={error}
              onSubmit={handleSubmit}
            />
          )}
        </DialogBody>
        {/* Footer fisso: il bottone submit sta fuori dallo scroll e punta al
            form via attributo form. Visibile solo quando un form è presente. */}
        {(groupId != null || friendIds.length > 0) && (
          <DialogFooter>
            <Button
              type="submit"
              form="global-bill-form"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Salvataggio in corso…' : 'Crea spesa'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Contesto gruppo: i membri arrivano da useGroupMembers (hook non chiamabile
// condizionalmente, quindi vive in un sotto-componente montato on-demand).
function GroupBillForm({
  groupId,
  isPending,
  error,
  onSubmit,
}: {
  groupId: number
  isPending: boolean
  error: string | null
  onSubmit: (values: BillFormValues) => void
}) {
  const membersQuery = useGroupMembers(groupId)

  if (membersQuery.isPending) {
    return (
      <div className="flex justify-center py-6">
        <LoaderCircle className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (membersQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(membersQuery.error)}</p>
        <Button variant="outline" size="sm" onClick={() => membersQuery.refetch()}>
          Riprova
        </Button>
      </div>
    )
  }

  return (
    <BillForm
      members={membersQuery.data ?? []}
      groupId={groupId}
      formId="global-bill-form"
      submitLabel="Crea spesa"
      isPending={isPending}
      error={error}
      onSubmit={onSubmit}
    />
  )
}
