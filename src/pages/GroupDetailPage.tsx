import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, LoaderCircle, LogOut, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import FriendPicker from '@/components/FriendPicker'
import BillCard from '@/components/BillCard'
import BillDetailDialog from '@/components/BillDetailDialog'
import { DeleteBillDialog, EditBillDialog, CreateBillDialog } from '@/components/BillDialogs'
import { SettlementList, PaySettlementDialog } from '@/components/SettlementList'
import { netBalanceClass } from '@/lib/money'
import { getApiErrorMessage } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'
import { useFriends } from '@/api/hooks/friends'
import { useGroupBills } from '@/api/hooks/bills'
import { useGroupBalance, useGroupSettlements } from '@/api/hooks/balance'
import {
  getGroupSettlementStatus,
  useAddGroupMembers,
  useDeleteGroup,
  useGroup,
  useGroupMembers,
  useLeaveGroup,
  useUpdateGroup,
} from '@/api/hooks/groups'
import type { components } from '@/api/types'

type SettlementDTO = components['schemas']['SettlementDTO']
type BillDTO = components['schemas']['BillDTO']
type GroupMemberDTO = components['schemas']['GroupMemberDTO']
type UserSettlementDTO = components['schemas']['UserSettlementDTO']

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatEuro(amount?: number) {
  return (amount ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default function GroupDetailPage() {
  const groupId = Number(useParams().groupId)
  const groupQuery = useGroup(groupId)
  const membersQuery = useGroupMembers(groupId)

  if (groupQuery.isPending || membersQuery.isPending) {
    return (
      <div className="flex justify-center py-12">
        <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (groupQuery.isError || membersQuery.isError) {
    const error = groupQuery.isError ? groupQuery.error : membersQuery.error
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(error)}</p>
        <Button
          variant="outline"
          onClick={() => {
            groupQuery.refetch()
            membersQuery.refetch()
          }}
        >
          Riprova
        </Button>
      </div>
    )
  }

  return (
    <GroupDetailBody
      groupId={groupId}
      name={groupQuery.data?.name ?? ''}
      description={groupQuery.data?.description ?? ''}
      creationDate={groupQuery.data?.creationDate}
      members={membersQuery.data ?? []}
    />
  )
}

function GroupDetailBody({
  groupId,
  name,
  description,
  creationDate,
  members,
}: {
  groupId: number
  name: string
  description: string
  creationDate?: string
  members: components['schemas']['GroupMemberDTO'][]
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = members.some((m) => m.userId === user?.userId && m.role === 'ADMIN')
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [createBillOpen, setCreateBillOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Torna ai gruppi"
          onClick={() => navigate('/groups')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{name}</h1>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-2 py-3">
          <div className="flex min-w-0 flex-col items-start gap-1">
            {description && <p className="text-sm">{description}</p>}
            <p className="text-muted-foreground text-xs">Creato il {formatDate(creationDate)}</p>
            <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)}>
              <Users />
              Visualizza membri ({members.length})
            </Button>
          </div>
          {/* Azioni sul gruppo: solo icone, sulla stessa riga */}
          <div className="flex shrink-0 gap-1">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Modifica gruppo"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  aria-label="Elimina gruppo"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label="Esci dal gruppo"
              onClick={() => setLeaveOpen(true)}
            >
              <LogOut />
            </Button>
          </div>
        </CardContent>
      </Card>

      <GroupBalanceSection groupId={groupId} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Spese</h2>
        <Button variant="outline" size="sm" onClick={() => setCreateBillOpen(true)}>
          <Plus />
          Nuova spesa
        </Button>
      </div>

      <GroupBills groupId={groupId} members={members} />

      <MembersDialog
        members={members}
        isAdmin={isAdmin}
        open={membersOpen}
        onOpenChange={setMembersOpen}
        onAddClick={() => setAddOpen(true)}
      />
      <CreateBillDialog
        groupId={groupId}
        members={members}
        open={createBillOpen}
        onOpenChange={setCreateBillOpen}
      />
      <EditGroupDialog
        groupId={groupId}
        name={name}
        description={description}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <AddMembersDialog
        groupId={groupId}
        members={members}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <DeleteGroupDialog groupId={groupId} open={deleteOpen} onOpenChange={setDeleteOpen} />
      <LeaveGroupDialog groupId={groupId} open={leaveOpen} onOpenChange={setLeaveOpen} />
    </div>
  )
}

// --- Sezione bilancio del gruppo: card con saldo + modale "chi deve a chi" ---

function GroupBalanceSection({ groupId }: { groupId: number }) {
  const balanceQuery = useGroupBalance(groupId)
  const settlementsQuery = useGroupSettlements(groupId)
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (balanceQuery.isPending || settlementsQuery.isPending) {
    return (
      <div className="flex justify-center py-6">
        <LoaderCircle className="text-muted-foreground size-6 animate-spin" />
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

  return (
    <>
      <h2 className="text-lg font-semibold">Bilancio</h2>
      <Card>
        <CardContent className="flex items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-sm">Il tuo saldo nel gruppo</p>
            <p className={`text-xl font-bold ${netBalanceClass(net)}`}>{formatEuro(net)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>
            Dettagli ({settlements.length})
          </Button>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bilancio del gruppo</DialogTitle>
            <DialogDescription>Chi deve a chi in questo gruppo.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <GroupSettlementsDialogBody settlements={settlements} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Corpo del modale bilancio: lista "chi deve a chi" con dialog di rimborso.
function GroupSettlementsDialogBody({ settlements }: { settlements: UserSettlementDTO[] }) {
  const [paying, setPaying] = useState<UserSettlementDTO | null>(null)

  return (
    <>
      <SettlementList settlements={settlements} onPay={setPaying} />
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
    </>
  )
}

// --- Dialog: elenco membri del gruppo ---

function MembersDialog({
  members,
  isAdmin,
  open,
  onOpenChange,
  onAddClick,
}: {
  members: components['schemas']['GroupMemberDTO'][]
  isAdmin: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddClick: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Membri ({members.length})</DialogTitle>
          <DialogDescription>Partecipanti del gruppo.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{member.username}</p>
                  <p className="text-muted-foreground truncate text-sm">{member.email}</p>
                </div>
                <span
                  className={
                    member.role === 'ADMIN'
                      ? 'bg-primary text-primary-foreground rounded-full px-2 py-1 text-xs font-medium'
                      : 'bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs'
                  }
                >
                  {member.role === 'ADMIN' ? 'Admin' : 'Membro'}
                </span>
              </li>
            ))}
          </ul>
        </DialogBody>
        {isAdmin && (
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={onAddClick}>
              <UserPlus />
              Aggiungi
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// --- Sezione spese del gruppo (lista paginata + modifica/eliminazione) ---

function GroupBills({
  groupId,
  members,
}: {
  groupId: number
  members: GroupMemberDTO[]
}) {
  const [page, setPage] = useState(0)
  const billsQuery = useGroupBills(groupId, page)
  const [viewingBill, setViewingBill] = useState<BillDTO | null>(null)
  const [editingBill, setEditingBill] = useState<BillDTO | null>(null)
  const [deletingBill, setDeletingBill] = useState<BillDTO | null>(null)

  // Nomi delle quote nel modale di dettaglio (le transazioni hanno solo userId).
  // I membri eliminati arrivano già come "UtenteEliminato"; fallback per userId ignoti.
  const resolveUsername = (userId: number) =>
    members.find((m) => m.userId === userId)?.username ?? 'UtenteEliminato'

  if (billsQuery.isPending) {
    return (
      <div className="flex justify-center py-6">
        <LoaderCircle className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (billsQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(billsQuery.error)}</p>
        <Button variant="outline" onClick={() => billsQuery.refetch()}>
          Riprova
        </Button>
      </div>
    )
  }

  const bills = billsQuery.data?.content ?? []
  const totalPages = billsQuery.data?.totalPages ?? 1

  return (
    <>
      {bills.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center">Nessuna spesa ancora.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bills.map((bill) => (
            <BillCard
              key={bill.billId}
              bill={bill}
              onClick={() => setViewingBill(bill)}
              // Qualsiasi membro attivo del gruppo può modificare/eliminare le spese.
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
          members={members}
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
    </>
  )
}

// --- Dialog: modifica nome/descrizione (solo admin) ---

function EditGroupDialog({
  groupId,
  name,
  description,
  open,
  onOpenChange,
}: {
  groupId: number
  name: string
  description: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateMutation = useUpdateGroup(groupId)
  const [newName, setNewName] = useState(name)
  const [newDescription, setNewDescription] = useState(description)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    updateMutation.mutate(
      { name: newName, description: newDescription },
      {
        onSuccess: () => {
          toast.success('Gruppo aggiornato')
          onOpenChange(false)
        },
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica gruppo</DialogTitle>
          <DialogDescription>Aggiorna nome e descrizione del gruppo.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="editGroupForm" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="editGroupName">Nome</FieldLabel>
                <Input
                  id="editGroupName"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="editGroupDescription">Descrizione</FieldLabel>
                <Input
                  id="editGroupDescription"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="submit"
            form="editGroupForm"
            className="w-full"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Salvataggio in corso…' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Dialog: aggiunta membri (solo admin) ---

function AddMembersDialog({
  groupId,
  members,
  open,
  onOpenChange,
}: {
  groupId: number
  members: components['schemas']['GroupMemberDTO'][]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const addMutation = useAddGroupMembers(groupId)
  const friendsQuery = useFriends(0)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const memberIds = new Set(members.map((m) => m.userId))
  const candidates = (friendsQuery.data?.content ?? []).filter((f) => !memberIds.has(f.userId))

  function toggle(userId: number) {
    setSelectedIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    addMutation.mutate(selectedIds, {
      onSuccess: () => {
        toast.success('Membri aggiunti')
        setSelectedIds([])
        onOpenChange(false)
      },
      onError: (err) => setError(getApiErrorMessage(err)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi membri</DialogTitle>
          <DialogDescription>Seleziona gli amici da aggiungere al gruppo.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="addMembersForm" onSubmit={handleSubmit}>
            <FieldGroup>
              <FriendPicker
                friends={candidates}
                selectedIds={selectedIds}
                onToggle={toggle}
                emptyText="Tutti i tuoi amici sono già nel gruppo."
              />
              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="submit"
            form="addMembersForm"
            className="w-full"
            disabled={selectedIds.length === 0 || addMutation.isPending}
          >
            {addMutation.isPending ? 'Aggiunta in corso…' : 'Aggiungi al gruppo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Dialog: eliminazione gruppo (solo admin, con gestione 409 debiti pendenti) ---

function DeleteGroupDialog({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteGroup()
  const [debts, setDebts] = useState<SettlementDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setDebts(null)
    setError(null)
    onOpenChange(false)
  }

  function handleDelete(force: boolean) {
    setError(null)
    deleteMutation.mutate(
      { groupId, force },
      {
        onSuccess: () => {
          toast.success('Gruppo eliminato')
          navigate('/groups')
        },
        onError: async (err) => {
          // 409: debiti pendenti — li carichiamo e li mostriamo prima del retry forzato.
          if (!force && axios.isAxiosError(err) && err.response?.status === 409) {
            try {
              setDebts(await getGroupSettlementStatus(groupId))
            } catch {
              setDebts([])
            }
            return
          }
          setError(getApiErrorMessage(err))
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
        else onOpenChange(true)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elimina gruppo</DialogTitle>
          <DialogDescription>
            {debts === null
              ? "L'eliminazione è definitiva. Vuoi procedere?"
              : 'Ci sono debiti pendenti tra i membri. Eliminando il gruppo andranno persi.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {debts !== null && (
            <ul className="flex flex-col gap-2">
              {debts.length === 0 && (
                <li className="text-muted-foreground text-sm">Nessun dettaglio disponibile.</li>
              )}
              {debts.map((debt, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{debt.debtor?.username}</span> deve{' '}
                  <span className="font-medium">{formatEuro(debt.amount)}</span> a{' '}
                  <span className="font-medium">{debt.creditor?.username}</span>
                </li>
              ))}
            </ul>
          )}

          {error && <FieldError>{error}</FieldError>}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annulla
          </Button>
          {debts === null ? (
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => handleDelete(false)}
            >
              Elimina
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => handleDelete(true)}
            >
              Elimina comunque
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Dialog: uscita dal gruppo ---

function LeaveGroupDialog({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const leaveMutation = useLeaveGroup()
  const [error, setError] = useState<string | null>(null)

  function handleLeave() {
    setError(null)
    leaveMutation.mutate(groupId, {
      onSuccess: () => {
        toast.success('Sei uscito dal gruppo')
        navigate('/groups')
      },
      onError: (err) => setError(getApiErrorMessage(err)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Esci dal gruppo</DialogTitle>
          <DialogDescription>
            Non vedrai più questo gruppo. I tuoi debiti e crediti nel gruppo diventano
            personali: li troverai nei Bilanci.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>{error && <FieldError>{error}</FieldError>}</DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            variant="destructive"
            disabled={leaveMutation.isPending}
            onClick={handleLeave}
          >
            Esci
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
