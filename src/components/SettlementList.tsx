import { useState, type FormEvent } from 'react'
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
import { formatEuro, parseAmountToCents } from '@/lib/money'
import { getApiErrorMessage } from '@/api/errors'
import { useCreatePayment } from '@/api/hooks/balance'
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
  if (settlements.length === 0) {
    return <p className="text-muted-foreground py-6 text-center">Nessun debito o credito aperto.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {settlements.map((settlement, i) => (
        <Card key={`${settlement.counterparty?.userId}-${settlement.groupId ?? 'personale'}-${i}`}>
          <CardContent className="flex items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              {settlement.direction === 'DEBT' ? (
                <p className="text-sm">
                  Devi <span className="font-medium">{formatEuro(settlement.amount)}</span> a{' '}
                  <span className="font-medium">{settlement.counterparty?.username}</span>
                </p>
              ) : (
                <p className="text-sm">
                  <span className="font-medium">{settlement.counterparty?.username}</span> ti deve{' '}
                  <span className="font-medium">{formatEuro(settlement.amount)}</span>
                </p>
              )}
              <p className="text-muted-foreground text-xs">{contextLabel(settlement)}</p>
            </div>
            {settlement.direction === 'DEBT' && (
              <Button variant="outline" size="sm" onClick={() => onPay(settlement)}>
                Rimborsa
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
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
    const amountCents = parseAmountToCents(amount)
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
                <Input
                  id="payAmount"
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
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
