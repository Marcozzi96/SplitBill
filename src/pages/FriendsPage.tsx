import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, LoaderCircle, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import SendFriendRequestDialog from '@/components/SendFriendRequestDialog'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/api/errors'
import {
  useAcceptFriendship,
  useCancelFriendship,
  useFriends,
  useFriendshipReqReceived,
  useFriendshipReqSent,
  useFriendshipRequestsCount,
  useRefuseFriendship,
} from '@/api/hooks/friends'
import type { components } from '@/api/types'

type UserDTO = components['schemas']['UserDTO']
type FriendshipReqRecDTO = components['schemas']['FriendshipReqRecDTO']
type FriendshipReqSenDTO = components['schemas']['FriendshipReqSenDTO']

type FriendsTab = 'friends' | 'received' | 'sent'

const TABS: { id: FriendsTab; label: string }[] = [
  { id: 'friends', label: 'Amici' },
  { id: 'received', label: 'Ricevute' },
  { id: 'sent', label: 'Inviate' },
]

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
  const [tab, setTab] = useState<FriendsTab>('friends')
  const [dialogOpen, setDialogOpen] = useState(false)
  // Stessa query del badge sulla bottom navigation: conteggio richieste in attesa.
  const { data: requestsCount = 0 } = useFriendshipRequestsCount()

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Amici</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus />
          Nuova richiesta
        </Button>
      </div>

      <div className="bg-muted grid grid-cols-3 rounded-lg p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'text-muted-foreground flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors',
              tab === id && 'bg-background text-foreground shadow-sm',
            )}
          >
            {label}
            {id === 'received' && requestsCount > 0 && (
              <span className="bg-destructive text-destructive-foreground flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                {requestsCount > 9 ? '9+' : requestsCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'friends' && <FriendsTab />}
      {tab === 'received' && <ReceivedTab />}
      {tab === 'sent' && <SentTab />}

      <SendFriendRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

// --- Tab: lista amici ---

function FriendsTab() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const friendsQuery = useFriends(page)
  const cancelMutation = useCancelFriendship()
  const [toRemove, setToRemove] = useState<UserDTO | null>(null)

  // Ricerca client-side: filtra per username/email la pagina caricata.
  const term = search.trim().toLowerCase()
  const allFriends = friendsQuery.data?.content ?? []
  const friends = term
    ? allFriends.filter(
        (f) =>
          f.username?.toLowerCase().includes(term) || f.email?.toLowerCase().includes(term),
      )
    : allFriends

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        placeholder="Cerca per username o email…"
        aria-label="Cerca amici"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <TabBody
        query={friendsQuery}
        emptyText="Nessun amico ancora: invia la prima richiesta."
        page={page}
        onPageChange={setPage}
      >
        {friends.length === 0 && allFriends.length > 0 ? (
          <p className="text-muted-foreground py-12 text-center">
            Nessun amico corrisponde alla ricerca.
          </p>
        ) : (
          friends.map((friend) => (
            <Card key={friend.userId}>
              <CardContent className="flex items-center gap-2 py-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigate(`/friends/${friend.userId}`)}
                >
                  <p className="truncate font-medium">{friend.username}</p>
                  <p className="text-muted-foreground truncate text-sm">{friend.email}</p>
                </button>
                <Button variant="destructive" size="sm" onClick={() => setToRemove(friend)}>
                  Rimuovi
                </Button>
              </CardContent>
            </Card>
          ))
        )}

        <Dialog open={!!toRemove} onOpenChange={(open) => !open && setToRemove(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rimuovi amico</DialogTitle>
              <DialogDescription
                render={<div className="flex flex-col gap-2" />}
              >
                <p>Rimuovere {toRemove?.username} dagli amici?</p>
                <p>
                  I conti in sospeso non andranno persi: i debiti e i crediti restano nella tua
                  Home per essere saldati. Tuttavia, non potrete più inserire nuove spese insieme.
                </p>
                <p>Puoi sempre inviare nuovamente la richiesta di amicizia in seguito.</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setToRemove(null)}>
                Annulla
              </Button>
              <Button
                variant="destructive"
                disabled={cancelMutation.isPending}
                onClick={() =>
                  toRemove?.userId != null &&
                  cancelMutation.mutate(toRemove.userId, {
                    onSuccess: () => {
                      toast.success('Amico rimosso')
                      setToRemove(null)
                    },
                    onError: (err) => toast.error(getApiErrorMessage(err)),
                  })
                }
              >
                Rimuovi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabBody>
    </div>
  )
}

// --- Tab: richieste ricevute ---

function ReceivedTab() {
  const [page, setPage] = useState(0)
  const receivedQuery = useFriendshipReqReceived(page)
  const acceptMutation = useAcceptFriendship()
  const refuseMutation = useRefuseFriendship()

  const pending = (receivedQuery.data?.content ?? []).filter((r) => r.stato === 'IN_ATTESA')

  function handle(action: 'accept' | 'refuse', req: FriendshipReqRecDTO) {
    const friendId = req.applicant?.userId
    if (friendId == null) return
    const mutation = action === 'accept' ? acceptMutation : refuseMutation
    mutation.mutate(friendId, {
      onSuccess: () =>
        toast.success(action === 'accept' ? 'Richiesta accettata' : 'Richiesta rifiutata'),
      onError: (err) => toast.error(getApiErrorMessage(err)),
    })
  }

  return (
    <TabBody
      query={receivedQuery}
      emptyText="Nessuna richiesta in attesa."
      page={page}
      onPageChange={setPage}
    >
      {pending.map((req) => (
        <Card key={req.friendshipId}>
          <CardContent className="flex flex-col gap-2 py-3">
            <div>
              <p className="font-medium">{req.applicant?.username}</p>
              {req.messaggio && <p className="text-muted-foreground text-sm">“{req.messaggio}”</p>}
              <p className="text-muted-foreground text-xs">{formatDate(req.dataRichiesta)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={acceptMutation.isPending || refuseMutation.isPending}
                onClick={() => handle('accept', req)}
              >
                <Check />
                Accetta
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={acceptMutation.isPending || refuseMutation.isPending}
                onClick={() => handle('refuse', req)}
              >
                <X />
                Rifiuta
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </TabBody>
  )
}

// --- Tab: richieste inviate ---

function SentTab() {
  const [page, setPage] = useState(0)
  const sentQuery = useFriendshipReqSent(page)
  const refuseMutation = useRefuseFriendship()

  function handleCancel(req: FriendshipReqSenDTO) {
    const friendId = req.recipient?.userId
    if (friendId == null) return
    refuseMutation.mutate(friendId, {
      onSuccess: () => toast.success('Richiesta annullata'),
      onError: (err) => toast.error(getApiErrorMessage(err)),
    })
  }

  return (
    <TabBody
      query={sentQuery}
      emptyText="Nessuna richiesta inviata."
      page={page}
      onPageChange={setPage}
    >
      {(sentQuery.data?.content ?? []).map((req) => (
        <Card key={req.friendshipId}>
          <CardContent className="flex items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{req.recipient?.username}</p>
              <p className="text-muted-foreground text-xs">
                {STATO_LABEL[req.stato ?? ''] ?? req.stato} · {formatDate(req.dataRichiesta)}
              </p>
            </div>
            {req.stato === 'IN_ATTESA' && (
              <Button
                variant="outline"
                size="sm"
                disabled={refuseMutation.isPending}
                onClick={() => handleCancel(req)}
              >
                Annulla
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </TabBody>
  )
}

// --- Corpo comune dei tab: stati loading/errore/vuoto + paginazione ---

function TabBody({
  query,
  emptyText,
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
  emptyText: string
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

  const totalPages = query.data?.totalPages ?? 1
  const isEmpty = (query.data?.content ?? []).length === 0

  return (
    <div className="flex flex-col gap-3">
      {isEmpty ? <p className="text-muted-foreground py-12 text-center">{emptyText}</p> : children}

      {totalPages > 1 && (
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
      )}
    </div>
  )
}
