import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatEuro } from '@/lib/money'
import type { components } from '@/api/types'

type BillDTO = components['schemas']['BillDTO']

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Quota di partecipazione di una transazione: le transazioni arrivano con
// segno (debitore = debito negativo, buyer = credito positivo), quindi la
// quota del buyer si ricava per differenza. Stessa logica di BillForm.
function shareOf(bill: BillDTO, userId?: number, amount?: number): number {
  if (userId == null || amount == null) return 0
  if (userId === bill.buyer?.userId) return (bill.amount ?? 0) - amount
  return -amount
}

// Modale di sola lettura con il dettaglio di una spesa: si apre cliccando la
// BillCard. Le azioni (modifica/elimina) restano sui bottoni della card.
// `resolveUsername` traduce gli userId delle transazioni in username (i DTO
// delle transazioni non lo includono).
export default function BillDetailDialog({
  bill,
  open,
  onOpenChange,
  resolveUsername,
}: {
  bill: BillDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
  resolveUsername: (userId: number) => string
}) {
  if (!bill) return null

  const transactions = bill.transactions ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bill.description}</DialogTitle>
          <DialogDescription>
            {formatDate(bill.creationDate)} · {bill.groupId != null ? 'Gruppo' : 'Personale'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-muted-foreground text-sm">Importo</p>
              <p className="text-xl font-bold">{formatEuro(bill.amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Pagato da</p>
              <p className="font-medium">{bill.buyer?.username}</p>
            </div>
            {bill.notes && (
              <div>
                <p className="text-muted-foreground text-sm">Note</p>
                <p className="text-sm whitespace-pre-wrap">{bill.notes}</p>
              </div>
            )}
            {transactions.length > 0 && (
              <div>
                <p className="text-muted-foreground text-sm">Quote</p>
                <ul className="flex flex-col gap-1">
                  {transactions.map((t, i) => (
                    <li
                      key={t.transactionId ?? i}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {t.userId != null ? resolveUsername(t.userId) : 'UtenteEliminato'}
                      </span>
                      <span>{formatEuro(shareOf(bill, t.userId, t.amount))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
