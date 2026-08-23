import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

// Avatar placeholder ("profilo vuoto"): cerchio neutro con icona utente,
// usato nelle card degli amici in attesa di una foto profilo.
export default function UserAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full',
        className,
      )}
    >
      <UserRound className="size-5" />
    </span>
  )
}
