import type { ReactNode } from 'react'
import { Receipt } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

// Card di una spesa: descrizione, importo, buyer e data. `actions` ospita
// eventuali bottoni (modifica/elimina nel dettaglio gruppo).
// L'icona distingue il contesto: verde = spesa personale, arancione = gruppo.
export default function BillCard({ bill, actions }: { bill: BillDTO; actions?: ReactNode }) {
  const isGroup = bill.groupId != null
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              isGroup ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success',
            )}
          >
            <Receipt className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{bill.description}</p>
            <p className="text-muted-foreground truncate text-sm">
              Pagata da {bill.buyer?.username} · {formatDate(bill.creationDate)}
            </p>
            {bill.notes && (
              <p className="text-muted-foreground line-clamp-1 text-sm">{bill.notes}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="font-semibold">{formatEuro(bill.amount)}</span>
          {actions}
        </div>
      </CardContent>
    </Card>
  )
}
