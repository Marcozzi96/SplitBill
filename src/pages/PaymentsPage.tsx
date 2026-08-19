import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatEuro } from '@/lib/money'
import { getApiErrorMessage } from '@/api/errors'
import { usePayments } from '@/api/hooks/balance'
import { useAuth } from '@/auth/auth-context'

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Cronologia dei rimborsi in cui l'utente è payer o payee.
export default function PaymentsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [page, setPage] = useState(0)
  const paymentsQuery = usePayments(page)

  if (paymentsQuery.isPending) {
    return (
      <div className="flex justify-center py-12">
        <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (paymentsQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(paymentsQuery.error)}</p>
        <Button variant="outline" onClick={() => paymentsQuery.refetch()}>
          Riprova
        </Button>
      </div>
    )
  }

  const payments = paymentsQuery.data?.content ?? []
  const totalPages = paymentsQuery.data?.totalPages ?? 1

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Torna ai bilanci"
          onClick={() => navigate('/balances')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold">Rimborsi</h1>
      </div>

      {payments.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">Nessun rimborso ancora.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {payments.map((payment) => {
            const isPayer = payment.payer?.userId === user?.userId
            return (
              <Card key={payment.paymentId}>
                <CardContent className="flex flex-col gap-1 py-3">
                  <p className="text-sm">
                    {isPayer ? (
                      <>
                        Hai rimborsato{' '}
                        <span className="font-medium">{formatEuro(payment.amount)}</span> a{' '}
                        <span className="font-medium">{payment.payee?.username}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{payment.payer?.username}</span> ti ha
                        rimborsato{' '}
                        <span className="font-medium">{formatEuro(payment.amount)}</span>
                      </>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(payment.date)}
                    {payment.groupId != null ? ' · di gruppo' : ' · personale'}
                    {payment.notes ? ` · ${payment.notes}` : ''}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Precedenti
          </Button>
          <span className="text-muted-foreground text-sm">
            Pagina {page + 1} di {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Successivi
          </Button>
        </div>
      )}
    </div>
  )
}
