import { useState } from 'react'
import { LoaderCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BalanceRow from '@/components/BalanceRow'
import CreateGroupDialog from '@/components/CreateGroupDialog'
import { getApiErrorMessage } from '@/api/errors'
import { useMySettlements } from '@/api/hooks/balance'
import { useGroups } from '@/api/hooks/groups'
import { byOpenBalance, netByGroup } from '@/lib/settlements'

export default function GroupsPage() {
  const [page, setPage] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const groupsQuery = useGroups(page)
  const settlementsQuery = useMySettlements()

  if (groupsQuery.isPending) {
    return (
      <div className="flex justify-center py-12">
        <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
      </div>
    )
  }

  if (groupsQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{getApiErrorMessage(groupsQuery.error)}</p>
        <Button variant="outline" onClick={() => groupsQuery.refetch()}>
          Riprova
        </Button>
      </div>
    )
  }

  // Saldo netto per gruppo dai settlement globali, già in cache dalla Home.
  // Se la query fallisce la lista resta usabile, senza saldi.
  const nets = settlementsQuery.data ? netByGroup(settlementsQuery.data) : undefined
  // Ordinamento per rilevanza nella pagina caricata: prima i saldi aperti.
  const groups = byOpenBalance(
    groupsQuery.data?.content ?? [],
    (g) => nets?.get(g.groupId ?? -1) ?? 0,
    (g) => g.name ?? '',
  )
  const totalPages = groupsQuery.data?.totalPages ?? 1

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">$ ls ~/gruppi</p>
        <h1 className="text-2xl font-bold">Gruppi</h1>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-muted-foreground">Nessun gruppo ancora.</p>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Users />
            Crea il primo gruppo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <BalanceRow
              key={group.groupId}
              to={`/groups/${group.groupId}`}
              name={group.name ?? ''}
              nameClassName="text-warning"
              subtext={groupSubtext(group.users?.length, group.description)}
              net={nets ? (nets.get(group.groupId ?? -1) ?? 0) : undefined}
              kind="group"
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

      <CreateGroupDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

// Sottotitolo della riga: il numero di membri (se il backend lo include nella
// lista) dice quanto è "vivo" il gruppo; in mancanza, la descrizione.
function groupSubtext(memberCount?: number, description?: string): string | undefined {
  if (memberCount != null) {
    const members = memberCount === 1 ? '1 membro' : `${memberCount} membri`
    return description ? `${members} · ${description}` : members
  }
  return description || undefined
}
