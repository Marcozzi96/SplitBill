import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { MoneyInput } from '@/components/MoneyInput'
import { formatEuro, resolveAmountToCents } from '@/lib/money'
import { getApiErrorMessage } from '@/api/errors'
import { useCreatePayment, useForgiveDebt } from '@/api/hooks/balance'
import type { components } from '@/api/types'

type UserSettlementDTO = components['schemas']['UserSettlementDTO']

function contextLabel(settlement: UserSettlementDTO): string {
  return settlement.groupName ? `gruppo: ${settlement.groupName}` : 'personale'
}

// "Chi deve a chi" dal punto di vista dell'utente: DEBT = devi soldi alla
// controparte (con azione di rimborso), CREDIT = la controparte deve a te.
// Condiviso tra HomePage (globale) e GroupDetailPage (nel gruppo).
export function SettlementList({
  settlements,
  onPay,
}: {
  settlements: UserSettlementDTO[]
  onPay: (settlement: UserSettlementDTO) => void
}) {
  const [deletedSettlement, setDeletedSettlement] = useState<UserSettlementDTO | null>(null)
  const navigate = useNavigate()

  if (settlements.length === 0) {
    return <p className="text-muted-foreground py-6 text-center">Nessun debito o credito aperto.</p>
  }

  // Click su un settlement: se è di gruppo porta al gruppo, altrimenti al
  // dettaglio dell'amico (tranne controparti eliminate, che non hanno pagina).
  function goToContext(settlement: UserSettlementDTO) {
    if (settlement.groupId != null) {
      navigate(`/groups/${settlement.groupId}`)
    } else if (settlement.counterparty?.userId != null && !settlement.counterparty.deleted) {
      navigate(`/friends/${settlement.counterparty.userId}`)
    }
  }

  // Controparti con account eliminato: icona di avviso che apre il dialog
  // informativo (con l'azione "Dimentica il debito" se il debito è verso di me).
  const deletedBadge = (settlement: UserSettlementDTO) =>
    settlement.counterparty?.deleted === true && (
      <button
        type="button"
        aria-label="Utente eliminato"
        onClick={(e) => {
          e.stopPropagation()
          setDeletedSettlement(settlement)
        }}
        className="text-destructive -my-3 inline-flex h-11 items-center justify-center px-2 align-middle"
      >
        <TriangleAlert className="size-4" aria-hidden />
      </button>
    )

  return (
    <div className="flex flex-col gap-2">
      {settlements.map((settlement, i) => (
        <Card
          key={`${settlement.counterparty?.userId}-${settlement.groupId ?? 'personale'}-${i}`}
          role="button"
          tabIndex={0}
          onClick={() => goToContext(settlement)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              goToContext(settlement)
            }
          }}
          className="hover:bg-accent/50 cursor-pointer transition-colors"
        >
          <CardContent className="flex items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              {settlement.direction === 'DEBT' ? (
                <p className="text-sm">
                  Devi <span className="font-medium">{formatEuro(settlement.amount)}</span> a{' '}
                  <span className="font-medium">{settlement.counterparty?.username}</span>
                  {deletedBadge(settlement)}
                </p>
              ) : (
                <p className="text-sm">
                  <span className="font-medium">{settlement.counterparty?.username}</span>
                  {deletedBadge(settlement)} ti deve{' '}
                  <span className="font-medium">{formatEuro(settlement.amount)}</span>
                </p>
              )}
              <p className="text-muted-foreground text-xs">{contextLabel(settlement)}</p>
            </div>
            {settlement.direction === 'DEBT' && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onPay(settlement)
                }}
              >
                Rimborsa
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {deletedSettlement && (
        <DeletedUserDialog
          settlement={deletedSettlement}
          open
          onOpenChange={(open) => {
            if (!open) setDeletedSettlement(null)
          }}
        />
      )}
    </div>
  )
}

// Dialog informativo per una controparte che ha eliminato l'account: le spese
// condivise restano visibili, ma non può più saldare. Se la direzione è CREDIT
// (l'eliminato deve soldi a me) il creditore può "dimenticare" l'intero debito:
// il backend lo estingue con un Payment automatico (400/404 → messaggio dal backend).
function DeletedUserDialog({
  settlement,
  open,
  onOpenChange,
}: {
  settlement: UserSettlementDTO
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const forgiveMutation = useForgiveDebt()
  const [error, setError] = useState<string | null>(null)

  function handleForgive() {
    setError(null)
    const payerId = settlement.counterparty?.userId
    if (payerId == null) {
      setError('Controparte non valida')
      return
    }
    forgiveMutation.mutate(
      { payerId, groupId: settlement.groupId ?? undefined },
      {
        onSuccess: () => {
          toast.success('Debito dimenticato')
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
          <DialogTitle>Utente eliminato</DialogTitle>
          <DialogDescription>
            Questo utente ha eliminato il proprio account. Le spese condivise restano visibili, ma
            non può più saldare i debiti.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>{error && <FieldError>{error}</FieldError>}</DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
          {settlement.direction === 'CREDIT' && (
            <Button
              variant="destructive"
              disabled={forgiveMutation.isPending}
              onClick={handleForgive}
            >
              Dimentica il debito
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Rimborso di un settlement: importo pre-compilato al massimo del debito.
// Il backend rifiuta con 409 se supera il debito effettivo: il messaggio
// arriva dal backend ed è mostrato nel dialog.
export function PaySettlementDialog({
  settlement,
  open,
  onOpenChange,
}: {
  settlement: UserSettlementDTO
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const payMutation = useCreatePayment()
  const [amount, setAmount] = useState(
    (settlement.amount ?? 0).toFixed(2).replace('.', ','),
  )
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const amountCents = resolveAmountToCents(amount)
    if (amountCents === null || amountCents <= 0) {
      setError('Inserisci un importo valido (es. 42,50)')
      return
    }
    const payeeId = settlement.counterparty?.userId
    if (payeeId == null) {
      setError('Controparte non valida')
      return
    }
    payMutation.mutate(
      {
        payeeId,
        amount: amountCents / 100,
        groupId: settlement.groupId ?? undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Rimborso registrato')
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
          <DialogTitle>Rimborsa {settlement.counterparty?.username}</DialogTitle>
          <DialogDescription>
            Debito {contextLabel(settlement)}: massimo {formatEuro(settlement.amount)}.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="paySettlementForm" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="payAmount">Importo (€)</FieldLabel>
                <MoneyInput
                  id="payAmount"
                  required
                  value={amount}
                  onChange={setAmount}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="payNotes">Note</FieldLabel>
                <Input id="payNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="submit"
            form="paySettlementForm"
            className="w-full"
            disabled={payMutation.isPending}
          >
            {payMutation.isPending ? 'Invio in corso…' : 'Registra rimborso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
