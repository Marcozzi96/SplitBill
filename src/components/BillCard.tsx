import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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

// Card di una spesa: descrizione, importo, buyer e data. `actions` ospita
// eventuali bottoni (modifica/elimina nel dettaglio gruppo).
export default function BillCard({ bill, actions }: { bill: BillDTO; actions?: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{bill.description}</p>
          <p className="text-muted-foreground truncate text-sm">
            Pagata da {bill.buyer?.username} · {formatDate(bill.creationDate)}
          </p>
          {bill.notes && (
            <p className="text-muted-foreground line-clamp-1 text-sm">{bill.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="font-semibold">{formatEuro(bill.amount)}</span>
          {actions}
        </div>
      </CardContent>
    </Card>
  )
}
