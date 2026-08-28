import { Receipt, StickyNote, Users } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { formatEuro } from '@/lib/money'
import { cn } from '@/lib/utils'
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

// Cerchio con l'iniziale dell'username, usato per buyer e partecipanti.
function InitialAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden
      className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
    >
      {initial}
    </span>
  )
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

  const isGroup = bill.groupId != null
  const transactions = bill.transactions ?? []
  const totalShares = transactions.reduce(
    (sum, t) => sum + shareOf(bill, t.userId, t.amount),
    0,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-2xl',
                isGroup ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success',
              )}
            >
              <Receipt className="size-6" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate">{bill.description}</DialogTitle>
              <DialogDescription>
                {formatDate(bill.creationDate)} · {isGroup ? 'Gruppo' : 'Personale'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <div className="bg-muted/60 rounded-2xl px-4 py-5 text-center">
              <p className="text-muted-foreground text-sm">Importo totale</p>
              <p className="text-3xl font-bold tracking-tight">{formatEuro(bill.amount)}</p>
            </div>
            <div className="flex items-center gap-3">
              <InitialAvatar name={bill.buyer?.username ?? ''} />
              <div className="min-w-0">
                <p className="text-muted-foreground text-sm">Pagato da</p>
                <p className="truncate font-medium">{bill.buyer?.username}</p>
              </div>
            </div>
            {bill.notes && (
              <div className="bg-muted/60 rounded-xl p-3">
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <StickyNote aria-hidden className="size-4" />
                  Note
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{bill.notes}</p>
              </div>
            )}
            {transactions.length > 0 && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Users aria-hidden className="size-4" />
                  Quote
                  <span className="ml-auto">{transactions.length} partecipanti</span>
                </p>
                <ul className="mt-2 flex flex-col">
                  {transactions.map((t, i) => {
                    const name =
                      t.userId != null ? resolveUsername(t.userId) : 'UtenteEliminato'
                    return (
                      <li
                        key={t.transactionId ?? i}
                        className="border-border flex items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <InitialAvatar name={name} />
                          <span className="min-w-0 truncate font-medium">{name}</span>
                        </span>
                        <span className="shrink-0 font-semibold">
                          {formatEuro(shareOf(bill, t.userId, t.amount))}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <Separator className="my-1" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Totale ripartito</span>
                  <span className="font-semibold">{formatEuro(totalShares)}</span>
                </div>
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
