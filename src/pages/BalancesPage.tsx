import { useState } from 'react'
import { Link } from 'react-router-dom'
import { History, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SettlementList, PaySettlementDialog } from '@/components/SettlementList'
import { formatEuro, netBalanceClass } from '@/lib/money'
import { getApiErrorMessage } from '@/api/errors'
import { useMyBalance, useMySettlements } from '@/api/hooks/balance'
import { cn } from '@/lib/utils'
import type { components } from '@/api/types'

type UserSettlementDTO = components['schemas']['UserSettlementDTO']

export default function BalancesPage() {
  const balanceQuery = useMyBalance()
  const settlementsQuery = useMySettlements()
  const [paying, setPaying] = useState<UserSettlementDTO | null>(null)

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

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bilanci</h1>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/payments" />}>
          <History />
          Cronologia
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1 py-4">
          <p className="text-muted-foreground text-sm">Saldo globale</p>
          <p className={cn('text-3xl font-bold', netBalanceClass(net))}>{formatEuro(net)}</p>
          <p className="text-muted-foreground text-sm">
            {net > 0
              ? 'Nel complesso ti devono soldi'
              : net < 0
                ? 'Nel complesso devi soldi'
                : 'Sei in pari'}
          </p>
          <p className="text-muted-foreground pt-2 text-xs">
            Pagato {formatEuro(balanceQuery.data?.totalPaid)} · Dovuto{' '}
            {formatEuro(balanceQuery.data?.totalOwed)}
          </p>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold">Chi deve a chi</h2>
      <SettlementList settlements={settlementsQuery.data ?? []} onPay={setPaying} />

      {paying && (
        <PaySettlementDialog
          key={`${paying.counterparty?.userId}-${paying.groupId ?? 'personale'}`}
          settlement={paying}
          open
          onOpenChange={(open) => {
            if (!open) setPaying(null)
          }}
        />
      )}
    </div>
  )
}
