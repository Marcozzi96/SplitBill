import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Home, Plus, Users, UsersRound, CircleUserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import GlobalCreateBillDialog from '@/components/GlobalCreateBillDialog'
import { cn } from '@/lib/utils'
import { useFriendshipRequestsCount } from '@/api/hooks/friends'

// Bottom navigation mobile-first: tap target >= 44px (h-16), safe-area per iOS.
const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/friends', label: 'Amici', icon: Users },
  { to: '/groups', label: 'Gruppi', icon: UsersRound },
  { to: '/profile', label: 'Profilo', icon: CircleUserRound },
] as const

export default function AppLayout() {
  // Badge con il numero di richieste di amicizia ricevute in attesa.
  const { data: requestsCount = 0 } = useFriendshipRequestsCount()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      {/* FAB globale: nuova spesa da qualsiasi schermata (gruppo o personale). */}
      <Button
        size="icon"
        aria-label="Nuova spesa"
        className="fixed right-4 bottom-20 z-40 size-14 rounded-full shadow-lg"
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="size-6" />
      </Button>
      <GlobalCreateBillDialog open={createOpen} onOpenChange={setCreateOpen} />
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
