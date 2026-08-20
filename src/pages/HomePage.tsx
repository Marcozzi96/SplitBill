import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SettlementList, PaySettlementDialog } from '@/components/SettlementList'
import PaymentsList from '@/components/PaymentsList'
import { netBalanceClass } from '@/lib/money'
import { formatEuro } from '@/lib/money'
import { getApiErrorMessage } from '@/api/errors'
import { useMyBalance, useMySettlements } from '@/api/hooks/balance'
import { useFriendshipRequestsCount } from '@/api/hooks/friends'
import { useAuth } from '@/auth/auth-context'
import { cn } from '@/lib/utils'
import type { components } from '@/api/types'

type UserSettlementDTO = components['schemas']['UserSettlementDTO']

// Home = bilanci globali: saldo, "chi deve a chi" con rimborso e cronologia.
export default function HomePage() {
  const { user } = useAuth()
  const balanceQuery = useMyBalance()
  const settlementsQuery = useMySettlements()
  const { data: requestsCount = 0 } = useFriendshipRequestsCount()
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
          <p className="text-muted-foreground pt-2 text-xs">
            Pagato {formatEuro(balanceQuery.data?.totalPaid)} · Dovuto{' '}
            {formatEuro(balanceQuery.data?.totalOwed)}
          </p>
        </CardContent>
      </Card>

      {/* Base UI smonta i pannelli inattivi: la query /payments parte
          solo quando si apre la tab Cronologia. */}
      <Tabs defaultValue="aperti">
        <TabsList className="w-full">
          <TabsTrigger value="aperti">Aperti</TabsTrigger>
          <TabsTrigger value="cronologia">Cronologia</TabsTrigger>
        </TabsList>
        <TabsContent value="aperti" className="pt-4">
          <SettlementList settlements={settlementsQuery.data ?? []} onPay={setPaying} />
        </TabsContent>
        <TabsContent value="cronologia" className="pt-4">
          <PaymentsList />
        </TabsContent>
      </Tabs>

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
