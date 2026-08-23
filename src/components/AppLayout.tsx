import { useState } from 'react'
import { NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import { Home, Plus, Users, UsersRound, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import GlobalCreateBillDialog from '@/components/GlobalCreateBillDialog'
import SendFriendRequestDialog from '@/components/SendFriendRequestDialog'
import CreateGroupDialog from '@/components/CreateGroupDialog'
import { cn } from '@/lib/utils'
import { useFriendshipRequestsCount } from '@/api/hooks/friends'

// Bottom navigation mobile-first: tap target >= 44px (h-16), safe-area per iOS.
const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/friends', label: 'Amici', icon: Users },
  { to: '/groups', label: 'Gruppi', icon: UsersRound },
  { to: '/settings', label: 'Impostazioni', icon: Settings },
] as const

export default function AppLayout() {
  // Badge con il numero di richieste di amicizia ricevute in attesa.
  const { data: requestsCount = 0 } = useFriendshipRequestsCount()
  const [createOpen, setCreateOpen] = useState(false)
  const location = useLocation()
  const isFriendsList = useMatch('/friends') != null
  const isGroupsList = useMatch('/groups') != null
  const friendMatch = useMatch('/friends/:userId')
  const groupMatch = useMatch('/groups/:groupId')

  // FAB contestuale: l'azione cambia in base alla pagina corrente.
  // - /friends: nuova richiesta di amicizia
  // - /friends/:userId: nuova spesa, default personale con quell'amico
  // - /groups: nuovo gruppo
  // - /groups/:groupId: nuova spesa, default quel gruppo
  // - altrove (Home, Impostazioni): nuova spesa con scelta del contesto
  const fabLabel = isFriendsList
    ? 'Nuova richiesta di amicizia'
    : isGroupsList
      ? 'Nuovo gruppo'
      : 'Nuova spesa'

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      {/* FAB contestuale: azione di creazione principale della schermata. */}
      <Button
        size="icon"
        aria-label={fabLabel}
        className="fixed right-4 bottom-20 z-40 size-14 rounded-full shadow-lg"
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="size-6" />
      </Button>
      {isFriendsList ? (
        <SendFriendRequestDialog open={createOpen} onOpenChange={setCreateOpen} />
      ) : isGroupsList ? (
        <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
      ) : (
        // key sul path: cambiando pagina il dialog riparte dai default di contesto.
        <GlobalCreateBillDialog
          key={location.pathname}
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultContext={groupMatch?.params.groupId}
          defaultFriendIds={
            friendMatch?.params.userId ? [Number(friendMatch.params.userId)] : undefined
          }
        />
      )}
      <nav className="bg-background fixed inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-lg">
          {NAV_ITEMS.map(({ to, label, icon: Icon, ...rest }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                {...('end' in rest ? { end: true } : {})}
                className={({ isActive }) =>
                  cn(
                    'text-muted-foreground flex h-16 flex-col items-center justify-center gap-1 text-xs',
                    isActive && 'text-primary font-medium',
                  )
                }
              >
                <span className="relative">
                  <Icon className="size-6" />
                  {to === '/friends' && requestsCount > 0 && (
                    <span className="bg-destructive text-destructive-foreground absolute -top-1.5 -right-2.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                      {requestsCount > 9 ? '9+' : requestsCount}
                    </span>
                  )}
                </span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
