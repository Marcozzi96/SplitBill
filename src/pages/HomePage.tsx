import { Link } from 'react-router-dom'
import { ArrowRight, LoaderCircle, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { netBalanceClass } from '@/lib/money'
import { formatEuro } from '@/lib/money'
import { getApiErrorMessage } from '@/api/errors'
import { useMyBalance, useMySettlements } from '@/api/hooks/balance'
import { useFriendshipRequestsCount } from '@/api/hooks/friends'
import { useAuth } from '@/auth/auth-context'
import { cn } from '@/lib/utils'

// Numero massimo di settlement mostrati in evidenza in dashboard.
const HIGHLIGHTED_SETTLEMENTS = 3

export default function HomePage() {
  const { user } = useAuth()
  const balanceQuery = useMyBalance()
  const settlementsQuery = useMySettlements()
  const { data: requestsCount = 0 } = useFriendshipRequestsCount()

  if (balanceQuery.isPending || settlementsQuery.isPending) {
    return (
      <div className="flex justify-center py-12">
        <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (balanceQuery.isError || settlementsQuery.isError) {
    const error = balanceQuery.isError ? balanceQuery.error : settlementsQuery.error
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(error)}</p>
        <Button
          variant="outline"
          onClick={() => {
            balanceQuery.refetch()
            settlementsQuery.refetch()
          }}
        >
          Riprova
        </Button>
      </div>
    )
  }

  const net = balanceQuery.data?.netBalance ?? 0
  const settlements = settlementsQuery.data ?? []
  const highlighted = settlements.slice(0, HIGHLIGHTED_SETTLEMENTS)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Ciao, {user?.username}</h1>

      {requestsCount > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between gap-2 py-3">
            <p className="text-sm">
              Hai <span className="font-medium">{requestsCount}</span>{' '}
              {requestsCount === 1 ? 'richiesta di amicizia' : 'richieste di amicizia'} in attesa
            </p>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/friends" />}>
              <UserPlus />
              Vedi
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-1 py-4">
          <p className="text-muted-foreground text-sm">Il tuo saldo globale</p>
          <p className={cn('text-3xl font-bold', netBalanceClass(net))}>{formatEuro(net)}</p>
          <p className="text-muted-foreground text-sm">
            {net > 0
              ? 'Nel complesso ti devono soldi'
              : net < 0
                ? 'Nel complesso devi soldi'
                : 'Sei in pari'}
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Chi deve a chi</h2>
        {settlements.length > 0 && (
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/balances" />}>
            Vedi tutti
            <ArrowRight />
          </Button>
        )}
      </div>

      {highlighted.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center">
          Nessun debito o credito aperto.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {highlighted.map((settlement, i) => (
            <Card
              key={`${settlement.counterparty?.userId}-${settlement.groupId ?? 'personale'}-${i}`}
            >
              <CardContent className="flex flex-col gap-1 py-3">
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
                <p className="text-muted-foreground text-xs">
                  {settlement.groupName ? `gruppo: ${settlement.groupName}` : 'personale'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
