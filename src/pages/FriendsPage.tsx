import { useState } from 'react'
import { Check, LoaderCircle, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import BalanceRow from '@/components/BalanceRow'
import SendFriendRequestDialog from '@/components/SendFriendRequestDialog'
import UserAvatar from '@/components/UserAvatar'
import { getApiErrorMessage } from '@/api/errors'
import { useMySettlements } from '@/api/hooks/balance'
import {
  useAcceptFriendship,
  useFriends,
  useFriendshipReqReceived,
  useFriendshipReqSent,
  useFriendshipRequestsCount,
  useRefuseFriendship,
} from '@/api/hooks/friends'
import { byOpenBalance, netByFriend } from '@/lib/settlements'
import type { components } from '@/api/types'

type FriendshipReqRecDTO = components['schemas']['FriendshipReqRecDTO']
type FriendshipReqSenDTO = components['schemas']['FriendshipReqSenDTO']

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATO_LABEL: Record<string, string> = {
  IN_ATTESA: 'In attesa',
  ACCETTATA: 'Accettata',
  RIFIUTATA: 'Rifiutata',
}

export default function FriendsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  // Stessa query del badge sulla bottom navigation: conteggio richieste in attesa.
  const { data: requestsCount = 0 } = useFriendshipRequestsCount()

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">$ ls ~/amici</p>
        <h1 className="text-2xl font-bold">Amici</h1>
      </div>

      {/* Base UI smonta i pannelli inattivi: le query delle richieste partono
          solo aprendo la tab (poi restano in cache). */}
      <Tabs defaultValue="amici">
        <TabsList className="w-full">
          <TabsTrigger value="amici">Amici</TabsTrigger>
          <TabsTrigger value="richieste">
            Richieste
            {requestsCount > 0 && (
              <span className="bg-destructive text-destructive-foreground flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                {requestsCount > 9 ? '9+' : requestsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="amici" className="pt-4">
          <FriendsTab onNewRequest={() => setDialogOpen(true)} />
        </TabsContent>
        <TabsContent value="richieste" className="pt-4">
          <RequestsTab />
        </TabsContent>
      </Tabs>

      <SendFriendRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

// --- Tab: lista amici (con saldo personale) ---

function FriendsTab({ onNewRequest }: { onNewRequest: () => void }) {
  const [page, setPage] = useState(0)
  const friendsQuery = useFriends(page)
  const settlementsQuery = useMySettlements()

  // Saldo personale (fuori dai gruppi) dai settlement globali, già in cache
  // dalla Home. Se la query fallisce la lista resta usabile, senza saldi.
  const nets = settlementsQuery.data ? netByFriend(settlementsQuery.data) : undefined
  // Ordinamento per rilevanza nella pagina caricata: prima i saldi aperti.
  const friends = byOpenBalance(
    friendsQuery.data?.content ?? [],
    (f) => nets?.get(f.userId ?? -1) ?? 0,
    (f) => f.username ?? '',
  )

  return (
    <TabBody
      query={friendsQuery}
      empty={
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-muted-foreground">Nessun amico ancora.</p>
          <Button variant="outline" onClick={onNewRequest}>
            <UserPlus />
            Invia la prima richiesta
          </Button>
        </div>
      }
      page={page}
      onPageChange={setPage}
    >
      {friends.map((friend) => (
        <BalanceRow
          key={friend.userId}
          to={`/friends/${friend.userId}`}
          name={friend.username ?? ''}
          nameClassName="text-chart-2"
          net={nets ? (nets.get(friend.userId ?? -1) ?? 0) : undefined}
          kind="person"
        />
      ))}
    </TabBody>
  )
}

// --- Tab: richieste (ricevute in cima, inviate sotto) ---

function RequestsTab() {
  const [receivedPage, setReceivedPage] = useState(0)
  const [sentPage, setSentPage] = useState(0)
  const receivedQuery = useFriendshipReqReceived(receivedPage)
  const sentQuery = useFriendshipReqSent(sentPage)
  const acceptMutation = useAcceptFriendship()
  const refuseMutation = useRefuseFriendship()

  if (receivedQuery.isPending || sentQuery.isPending) {
    return (
      <div className="flex justify-center py-12">
        <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (receivedQuery.isError || sentQuery.isError) {
    const error = receivedQuery.isError ? receivedQuery.error : sentQuery.error
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(error)}</p>
        <Button
          variant="outline"
          onClick={() => {
            receivedQuery.refetch()
            sentQuery.refetch()
          }}
        >
          Riprova
        </Button>
      </div>
    )
  }

  // Tra le ricevute contano solo quelle in attesa; le inviate si mostrano
  // in qualsiasi stato (le accettate/rifiutate restano come storico).
  const received = (receivedQuery.data?.content ?? []).filter((r) => r.stato === 'IN_ATTESA')
  const sent = sentQuery.data?.content ?? []

  if (received.length === 0 && sent.length === 0) {
    return <p className="text-muted-foreground py-12 text-center">Nessuna richiesta in sospeso.</p>
  }

  function handleReceived(action: 'accept' | 'refuse', req: FriendshipReqRecDTO) {
    const friendId = req.applicant?.userId
    if (friendId == null) return
    const mutation = action === 'accept' ? acceptMutation : refuseMutation
    mutation.mutate(friendId, {
      onSuccess: () =>
        toast.success(action === 'accept' ? 'Richiesta accettata' : 'Richiesta rifiutata'),
      onError: (err) => toast.error(getApiErrorMessage(err)),
    })
  }

  function handleCancelSent(req: FriendshipReqSenDTO) {
    const friendId = req.recipient?.userId
    if (friendId == null) return
    refuseMutation.mutate(friendId, {
      onSuccess: () => toast.success('Richiesta annullata'),
      onError: (err) => toast.error(getApiErrorMessage(err)),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {received.length > 0 && (
        <section className="flex flex-col gap-2">
          {sent.length > 0 && <h2 className="text-muted-foreground text-sm">Ricevute</h2>}
          {received.map((req) => (
            <Card key={req.friendshipId}>
              <CardContent className="flex flex-col gap-2 py-3">
                <div className="flex items-center gap-3">
                  <UserAvatar />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{req.applicant?.username}</p>
                    {req.messaggio && (
                      <p className="text-muted-foreground text-sm">“{req.messaggio}”</p>
                    )}
                    <p className="text-muted-foreground text-xs">{formatDate(req.dataRichiesta)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={acceptMutation.isPending || refuseMutation.isPending}
                    onClick={() => handleReceived('accept', req)}
                  >
                    <Check />
                    Accetta
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={acceptMutation.isPending || refuseMutation.isPending}
                    onClick={() => handleReceived('refuse', req)}
                  >
                    <X />
                    Rifiuta
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Pager
            totalPages={receivedQuery.data?.totalPages ?? 1}
            page={receivedPage}
            onPageChange={setReceivedPage}
          />
        </section>
      )}

      {sent.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm">Inviate</h2>
          {sent.map((req) => (
            <Card key={req.friendshipId}>
              <CardContent className="flex items-center justify-between gap-2 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{req.recipient?.username}</p>
                    <p className="text-muted-foreground text-xs">
                      {STATO_LABEL[req.stato ?? ''] ?? req.stato} · {formatDate(req.dataRichiesta)}
                    </p>
                  </div>
                </div>
                {req.stato === 'IN_ATTESA' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={refuseMutation.isPending}
                    onClick={() => handleCancelSent(req)}
                  >
                    Annulla
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          <Pager
            totalPages={sentQuery.data?.totalPages ?? 1}
            page={sentPage}
            onPageChange={setSentPage}
          />
        </section>
      )}
    </div>
  )
}

// --- Corpo comune: stati loading/errore/vuoto + paginazione ---

function TabBody({
  query,
  empty,
  page,
  onPageChange,
  children,
}: {
  query: {
    data?: { content?: unknown[]; totalPages?: number; number?: number }
    isPending: boolean
    isError: boolean
    error: unknown
    refetch: () => void
  }
  empty: React.ReactNode
  page: number
  onPageChange: (page: number) => void
  children: React.ReactNode
}) {
  if (query.isPending) {
    return (
      <div className="flex justify-center py-12">
        <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(query.error)}</p>
        <Button variant="outline" onClick={() => query.refetch()}>
          Riprova
        </Button>
      </div>
    )
  }

  const isEmpty = (query.data?.content ?? []).length === 0

  return (
    <div className="flex flex-col gap-3">
      {isEmpty ? empty : children}
      <Pager totalPages={query.data?.totalPages ?? 1} page={page} onPageChange={onPageChange} />
    </div>
  )
}

function Pager({
  totalPages,
  page,
  onPageChange,
}: {
  totalPages: number
  page: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
        Precedenti
      </Button>
      <span className="text-muted-foreground text-sm">
        Pagina {page + 1} di {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page + 1 >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Successivi
      </Button>
    </div>
  )
}
