import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BillCard from '@/components/BillCard'
import BillDetailDialog from '@/components/BillDetailDialog'
import { DeleteBillDialog, EditBillDialog, CreateBillDialog } from '@/components/BillDialogs'
import { getApiErrorMessage } from '@/api/errors'
import { useMyBills } from '@/api/hooks/bills'
import { useFriends } from '@/api/hooks/friends'
import { useAuth } from '@/auth/auth-context'
import type { components } from '@/api/types'

type BillDTO = components['schemas']['BillDTO']
type GroupMemberDTO = components['schemas']['GroupMemberDTO']

// Dettaglio amico: elenco delle spese SENZA gruppo condivise con quell'amico.
// Le spese personali si ottengono filtrando /bills/getMyBills (groupId nullo e
// amico coinvolto come buyer o debitore): il filtro vale sulla pagina caricata.
export default function FriendDetailPage() {
  const friendId = Number(useParams().userId)
  const navigate = useNavigate()
  const { user } = useAuth()
  const friendsQuery = useFriends(0)
  const [page, setPage] = useState(0)
  const billsQuery = useMyBills(page)
  const [editingBill, setEditingBill] = useState<BillDTO | null>(null)
  const [deletingBill, setDeletingBill] = useState<BillDTO | null>(null)
  const [viewingBill, setViewingBill] = useState<BillDTO | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  if (friendsQuery.isPending || billsQuery.isPending) {
    return (
      <div className="flex justify-center py-12">
        <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (friendsQuery.isError || billsQuery.isError) {
    const error = friendsQuery.isError ? friendsQuery.error : billsQuery.error
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(error)}</p>
        <Button
          variant="outline"
          onClick={() => {
            friendsQuery.refetch()
            billsQuery.refetch()
          }}
        >
          Riprova
        </Button>
      </div>
    )
  }

  const friend = (friendsQuery.data?.content ?? []).find((f) => f.userId === friendId)
  if (!friend) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Torna agli amici"
            onClick={() => navigate('/friends')}
          >
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl font-bold">Amico non trovato</h1>
        </div>
        <p className="text-muted-foreground py-12 text-center">
          Torna alla lista Amici e riprova.
        </p>
      </div>
    )
  }

  const bills = (billsQuery.data?.content ?? []).filter(
    (bill) =>
      bill.groupId == null &&
      (bill.buyer?.userId === friendId || bill.transactions?.some((t) => t.userId === friendId)),
  )
  const totalPages = billsQuery.data?.totalPages ?? 1

  // Modifica/eliminazione: chiunque sia coinvolto nella spesa personale (buyer o
  // debitore) — lo impone anche il backend. Le spese elencate qui mi coinvolgono
  // sempre, quindi le azioni sono sempre visibili.
  // I partecipanti del form sono sempre io + l'amico.
  const editMembers: GroupMemberDTO[] = [
    { userId: user?.userId, username: user?.username, email: user?.email },
    { userId: friend.userId, username: friend.username, email: friend.email },
  ]

  // Nomi delle quote nel modale di dettaglio (le transazioni hanno solo userId).
  const resolveUsername = (userId: number) =>
    editMembers.find((m) => m.userId === userId)?.username ?? 'UtenteEliminato'

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Torna agli amici"
          onClick={() => navigate('/friends')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{friend.username}</h1>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus />
          Nuova spesa
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        Le spese fuori dai gruppi tra te e {friend.username}.
      </p>

      {bills.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          Nessuna spesa condivisa con {friend.username}.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {bills.map((bill) => (
            <BillCard
              key={bill.billId}
              bill={bill}
              onClick={() => setViewingBill(bill)}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Modifica ${bill.description}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingBill(bill)
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Elimina ${bill.description}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeletingBill(bill)
                    }}
                  >
                    <Trash2 />
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
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

      <BillDetailDialog
        bill={viewingBill}
        open={viewingBill != null}
        onOpenChange={(open) => {
          if (!open) setViewingBill(null)
        }}
        resolveUsername={resolveUsername}
      />
      {editingBill && (
        <EditBillDialog
          key={editingBill.billId}
          bill={editingBill}
          members={editMembers}
          open
          onOpenChange={(open) => {
            if (!open) setEditingBill(null)
          }}
        />
      )}
      {deletingBill && (
        <DeleteBillDialog
          bill={deletingBill}
          open
          onOpenChange={(open) => {
            if (!open) setDeletingBill(null)
          }}
        />
      )}
      <CreateBillDialog members={editMembers} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
