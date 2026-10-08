import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { formatEuro, netBalanceClass } from '@/lib/money'
import { cn } from '@/lib/utils'

// Riga condivisa delle liste Amici/Gruppi: nome a sinistra (con il cursore
// ">" in hover, come i settlement della Home) e saldo netto a destra.
// - kind "person": il saldo è a parole ("ti deve 12,50 €" / "devi 8,00 €")
// - kind "group": il saldo è con segno ("+12,50 €" / "−8,00 €"), perché
//   somma più controparti nel gruppo
// net undefined = saldo non disponibile (es. query settlements in errore).
export default function BalanceRow({
  to,
  name,
  nameClassName,
  subtext,
  net,
  kind,
}: {
  to: string
  name: string
  nameClassName?: string
  subtext?: string
  net?: number
  kind: 'person' | 'group'
}) {
  return (
    <Link to={to} className="group block">
      <Card className="hover:bg-accent/50 transition-colors">
        <CardContent className="flex items-center justify-between gap-2 py-3">
          <div className="flex min-w-0 items-center gap-1">
            <span
              aria-hidden
              className="text-primary w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            >
              &gt;
            </span>
            <div className="min-w-0">
              <p className={cn('truncate font-medium', nameClassName)}>{name}</p>
              {subtext && <p className="text-muted-foreground truncate text-xs">{subtext}</p>}
            </div>
          </div>
          {net !== undefined && (
            <span className={cn('shrink-0 text-sm font-medium', netBalanceClass(net))}>
              {balanceLabel(net, kind)}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function balanceLabel(net: number, kind: 'person' | 'group'): string {
  if (net === 0) return 'in pari'
  if (kind === 'group') return `${net > 0 ? '+' : '−'}${formatEuro(Math.abs(net))}`
  return net > 0 ? `ti deve ${formatEuro(net)}` : `devi ${formatEuro(-net)}`
}
