import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// Righe mostrate in sequenza, come l'avvio di una CLI. Corte: devono stare
// su una riga sola anche a 360px di larghezza.
const BOOT_LINES = [
  '$ splitbill --init',
  '> server cassa ........ OK',
  '> token utente ........ OK',
  '> debiti e crediti .... OK',
  '> pronto: che nessuno resti in debito',
] as const

const LINE_DELAY_MS = 300
const DONE_DELAY_MS = 650
const FADE_MS = 350
const SESSION_KEY = 'splitbill_booted'

// Sequenza di avvio stile terminale: una volta per sessione, saltabile con un
// tocco e disattivata con prefers-reduced-motion. Sovrappone l'app per ~2.5s.
export default function BootSequence() {
  const [visibleLines, setVisibleLines] = useState(0)
  const [fading, setFading] = useState(false)
  const [done, setDone] = useState(() => {
    if (typeof window === 'undefined') return true
    if (typeof window.matchMedia !== 'function') return true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    return sessionStorage.getItem(SESSION_KEY) === '1'
  })

  useEffect(() => {
    if (done) return
    const timers: ReturnType<typeof setTimeout>[] = []
    BOOT_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), LINE_DELAY_MS * (i + 1)))
    })
    const total = LINE_DELAY_MS * BOOT_LINES.length + DONE_DELAY_MS
    timers.push(setTimeout(() => setFading(true), total))
    timers.push(
      setTimeout(() => {
        sessionStorage.setItem(SESSION_KEY, '1')
        setDone(true)
      }, total + FADE_MS),
    )
    return () => timers.forEach(clearTimeout)
  }, [done])

  if (done) return null

  function skip() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setDone(true)
  }

  return (
    <div
      role="presentation"
      onClick={skip}
      className={cn(
        'bg-background fixed inset-0 z-[200] cursor-pointer p-6 transition-opacity',
        fading && 'opacity-0',
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="text-primary crt-glow mx-auto flex h-full max-w-lg flex-col justify-center gap-2 text-sm sm:text-base">
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
          <p
            key={line}
            className={cn(
              i === BOOT_LINES.length - 1 && visibleLines === BOOT_LINES.length && 'cursor-blink',
            )}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}
