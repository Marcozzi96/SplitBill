import { useState } from 'react'
import { NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import { Home, Plus, Users, Settings } from 'lucide-react'
import GroupsCircleIcon from '@/components/GroupsCircleIcon'
import { Button } from '@/components/ui/button'
import GlobalCreateBillDialog from '@/components/GlobalCreateBillDialog'
import SendFriendRequestDialog from '@/components/SendFriendRequestDialog'
import CreateGroupDialog from '@/components/CreateGroupDialog'
import { cn } from '@/lib/utils'
import { useFabPosition } from '@/lib/useFabPosition'
import { useFriendshipRequestsCount } from '@/api/hooks/friends'

// Bottom navigation mobile-first: tap target >= 44px (h-16), safe-area per iOS.
const NAV_ITEMS = [
  { to: '/', label: 'home', icon: Home, end: true },
  { to: '/friends', label: 'amici', icon: Users },
  // iconClass: l'icona custom dei gruppi riempie meno la viewBox delle icone
  // lucide, quindi va leggermente ingrandita per apparire delle stesse dimensioni.
  { to: '/groups', label: 'gruppi', icon: GroupsCircleIcon, iconClass: 'size-8.5' },
  { to: '/settings', label: 'impostazioni', icon: Settings },
] as const

export default function AppLayout() {
  // Badge con il numero di richieste di amicizia ricevute in attesa.
  const { data: requestsCount = 0 } = useFriendshipRequestsCount()
  const [createOpen, setCreateOpen] = useState(false)
  const {
    buttonRef: fabRef,
    position: fabPosition,
    dragging: fabDragging,
    handlePointerDown: handleFabPointerDown,
    handlePointerMove: handleFabPointerMove,
    handlePointerUp: handleFabPointerUp,
    handlePointerCancel: handleFabPointerCancel,
    handleClick: handleFabClick,
  } = useFabPosition()
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
  // Etichetta breve mostrata nel FAB (l'aria-label resta quella completa).
  const fabShortLabel = isFriendsList ? 'amico' : isGroupsList ? 'gruppo' : 'spesa'

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 pb-20">
        {/* key sul path: a ogni cambio rotta il wrapper si rimonta e riparte
            l'animazione di ingresso pagina (crt-page-in). */}
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      {/* FAB contestuale: azione di creazione principale della schermata. */}
      <Button
        ref={fabRef}
        aria-label={fabLabel}
        aria-description="Tieni premuto per spostare il pulsante. Da tastiera usa Alt e le frecce direzionali."
        aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
        title="Tieni premuto per spostare · Alt + frecce da tastiera"
        style={
          fabPosition
            ? { left: fabPosition.x, top: fabPosition.y, right: 'auto', bottom: 'auto' }
            : undefined
        }
        className={cn(
          'ring-primary/60 fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 h-14 w-auto touch-none gap-1.5 rounded-lg px-4 text-sm font-bold shadow-lg ring-1 dark:shadow-[0_0_22px_rgb(52_211_153/0.35)]',
          fabDragging
            ? 'scale-105 cursor-grabbing ring-2 ring-offset-2 ring-offset-background active:translate-y-0'
            : 'cursor-pointer',
        )}
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        onPointerCancel={handleFabPointerCancel}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
        onClick={(event) => {
          if (!handleFabClick(event)) setCreateOpen(true)
        }}
      >
        <Plus className="size-5" />
        {fabShortLabel}
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
              {/* replace: i tab principali non si accumulano nella cronologia,
                  così il pulsante indietro da un tab senza popup aperti esce
                  dall'app invece di scorrere i tab visitati (stile nativo). */}
              <NavLink
                to={to}
                replace
                {...('end' in rest ? { end: true } : {})}
                className={({ isActive }) =>
                  cn(
                    'text-muted-foreground flex h-16 flex-col items-center justify-center gap-1 text-xs',
                    isActive && 'text-primary font-bold',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon className={cn('size-6', 'iconClass' in rest && rest.iconClass)} />
                      {to === '/friends' && requestsCount > 0 && (
                        <span className="bg-destructive text-destructive-foreground absolute -top-1.5 -right-2.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
                          {requestsCount > 9 ? '9+' : requestsCount}
                        </span>
                      )}
                    </span>
                    {/* Voce attiva racchiusa tra parentesi quadre, stile CLI. */}
                    <span>{isActive ? `[${label}]` : label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
