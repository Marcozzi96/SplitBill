import { useState } from 'react'
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
import { FieldError } from '@/components/ui/field'
import BillForm, { type BillFormValues } from '@/components/BillForm'
import { getApiErrorMessage } from '@/api/errors'
import { useDeleteBill, useUpdateBill, useCreateBill } from '@/api/hooks/bills'
import type { components } from '@/api/types'

type BillDTO = components['schemas']['BillDTO']
type GroupMemberDTO = components['schemas']['GroupMemberDTO']

// Dialog condivisi tra dettaglio gruppo e dettaglio amico (spese personali).
// Creazione e modifica usano lo stesso modale con lo stesso BillForm.

// Nuova spesa: dal dettaglio gruppo (con groupId) o dal dettaglio amico
// (senza groupId, spesa personale).
export function CreateBillDialog({
  members,
  groupId,
  open,
  onOpenChange,
}: {
  members: GroupMemberDTO[]
  /** Se assente, la spesa è personale (tra amici). */
  groupId?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createMutation = useCreateBill()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(values: BillFormValues) {
    setError(null)
    createMutation.mutate(
      {
        groupId,
        description: values.description,
        notes: values.notes,
        amount: values.amountCents / 100,
        buyerId: values.buyerId,
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova spesa</DialogTitle>
          <DialogDescription>
            Inserisci descrizione, importo, chi ha pagato e la ripartizione.
          </DialogDescription>
        </DialogHeader>
        <BillForm
          members={members}
          submitLabel="Crea spesa"
          isPending={createMutation.isPending}
          error={error}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  )
}

// Modifica spesa: qualsiasi membro attivo del gruppo; per le spese personali
// chiunque sia coinvolto (buyer o debitore).
export function EditBillDialog({
  bill,
  members,
  open,
  onOpenChange,
}: {
  bill: BillDTO
  members: GroupMemberDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateMutation = useUpdateBill(bill.billId!)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(values: BillFormValues) {
    setError(null)
    updateMutation.mutate(
      {
        description: values.description,
        notes: values.notes,
        amount: values.amountCents / 100,
        buyerId: values.buyerId,
        shares: Object.fromEntries(
          Object.entries(values.sharesCents).map(([userId, cents]) => [userId, cents / 100]),
        ),
      },
      {
        onSuccess: () => {
          toast.success('Spesa aggiornata')
          onOpenChange(false)
        },
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica spesa</DialogTitle>
          <DialogDescription>
            Aggiorna descrizione, importo, note e ripartizione della spesa.
          </DialogDescription>
        </DialogHeader>
        <BillForm
          members={members}
          bill={bill}
          submitLabel="Salva"
          isPending={updateMutation.isPending}
          error={error}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  )
}

// Eliminazione spesa: stesse regole della modifica (membri del gruppo / coinvolti).
export function DeleteBillDialog({
  bill,
  open,
  onOpenChange,
}: {
  bill: BillDTO
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const deleteMutation = useDeleteBill()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    setError(null)
    deleteMutation.mutate(bill.billId!, {
      onSuccess: () => {
        toast.success('Spesa eliminata')
        onOpenChange(false)
      },
      onError: (err) => setError(getApiErrorMessage(err)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elimina spesa</DialogTitle>
          <DialogDescription>
            Eliminare &quot;{bill.description}&quot;? L&apos;operazione è definitiva.
          </DialogDescription>
        </DialogHeader>
        {error && <FieldError>{error}</FieldError>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button variant="destructive" disabled={deleteMutation.isPending} onClick={handleDelete}>
            Elimina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
