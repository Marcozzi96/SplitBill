import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Input } from '@/components/ui/input'
import { NumericKeypad, type KeypadKey } from '@/components/NumericKeypad'
import {
  centsToAmountInput,
  evaluateMoneyExpression,
  formatEuro,
  EXPRESSION_OPERATOR_REGEX,
} from '@/lib/money'
import { cn } from '@/lib/utils'

// Altezza approssimativa del tastierino: serve a decidere se il campo attivo
// va fatto scorrere in vista per non finire coperto dal bottom sheet.
const KEYPAD_HEIGHT = 450

// Input monetario con tastierino "calcolatrice" custom (stile Satispay):
// inputMode="none" impedisce l'apertura della tastiera di sistema su mobile;
// al focus il tastierino compare come bottom sheet fisso in fondo allo schermo
// (portal su document.body: il Dialog ha overflow-hidden e transform, uno sheet
// interno verrebbe tagliato/disancorato). Posizione sempre identica, come la
// tastiera di sistema; senza backdrop, così il tap su un altro campo sposta
// subito il focus (la chiusura resta affidata al blur). In cima allo sheet uno
// schermino stile calcolatrice CRT (font VT323 + glow) mostra il valore mentre
// si digita, visto che il campo editato può finire coperto dallo sheet. Su
// desktop la tastiera fisica continua a funzionare normalmente. Se il valore è
// un'espressione ("12,50 + 3") mostra l'anteprima del risultato; "=" o il blur
// la risolvono nel campo.
export function MoneyInput({
  value,
  onChange,
  className,
  wrapperClassName,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'inputMode' | 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  /** Classi del contenitore dell'input, es. vincoli di larghezza. */
  wrapperClassName?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const displayRef = useRef<HTMLParagraphElement>(null)
  const [keypadOpen, setKeypadOpen] = useState(false)
  // Posizione reale del caret, sincronizzata con l'input (null = in fondo).
  const [caret, setCaret] = useState<number | null>(null)

  const isExpression = EXPRESSION_OPERATOR_REGEX.test(value)
  const evaluatedCents = isExpression ? evaluateMoneyExpression(value) : null
  const caretPos = Math.min(caret ?? value.length, value.length)

  // Lo schermino del tastierino segue sempre la fine dell'espressione.
  useEffect(() => {
    const el = displayRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [value, keypadOpen])

  function openKeypad() {
    setKeypadOpen(true)
    // Se il campo finirebbe sotto il bottom sheet, lo porta in vista.
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - KEYPAD_HEIGHT || rect.top < 0) {
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }
  }

  function closeKeypad() {
    setKeypadOpen(false)
  }

  function resolveExpression() {
    if (!isExpression) return
    const cents = evaluateMoneyExpression(value)
    if (cents !== null) {
      onChange(centsToAmountInput(cents))
      setCaret(null)
    }
  }

  // Sposta il caret (schermino del tastierino: tap su una cifra).
  function moveCaret(pos: number) {
    const clamped = Math.max(0, Math.min(pos, value.length))
    setCaret(clamped)
    const el = inputRef.current
    el?.focus()
    el?.setSelectionRange(clamped, clamped)
  }

  // Tap su una cifra dello schermino: metà sinistra = caret prima del
  // carattere, metà destra = dopo.
  function handleDisplayCharClick(e: React.MouseEvent, index: number) {
    const rect = e.currentTarget.getBoundingClientRect()
    const before = e.clientX - rect.left < rect.width / 2
    moveCaret(before ? index : index + 1)
  }

  // Inserisce/cancella alla posizione del cursore (fallback: in fondo).
  function insertText(text: string) {
    const el = inputRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    onChange(value.slice(0, start) + text + value.slice(end))
    setCaret(start + text.length)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + text.length, start + text.length)
    })
  }

  function handleKey(key: KeypadKey) {
    if (key === 'done') {
      resolveExpression()
      closeKeypad()
      return
    }
    if (key === 'equals') {
      resolveExpression()
      return
    }
    if (key === 'backspace') {
      const el = inputRef.current
      const start = el?.selectionStart ?? value.length
      const end = el?.selectionEnd ?? value.length
      if (start === end) {
        if (start === 0) return
        onChange(value.slice(0, start - 1) + value.slice(end))
        setCaret(start - 1)
        requestAnimationFrame(() => {
          el?.focus()
          el?.setSelectionRange(start - 1, start - 1)
        })
      } else {
        onChange(value.slice(0, start) + value.slice(end))
        setCaret(start)
        requestAnimationFrame(() => {
          el?.focus()
          el?.setSelectionRange(start, start)
        })
      }
      return
    }
    insertText(key)
  }

  return (
    <div className={cn('min-w-0', wrapperClassName)}>
      <Input
        ref={inputRef}
        inputMode="none"
        autoComplete="off"
        value={value}
        disabled={disabled}
        className={className}
        onChange={(e) => onChange(e.target.value)}
        // onFocus copre il primo focus; onClick riapre il tastierino quando il
        // campo è già in focus (dopo "Fine"/Esc) e l'utente ci clicca di nuovo.
        onFocus={openKeypad}
        onClick={openKeypad}
        // I tasti del tastierino fanno preventDefault su pointerdown, quindi
        // il blur scatta solo quando il focus va davvero altrove.
        onBlur={() => {
          resolveExpression()
          closeKeypad()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeKeypad()
        }}
        // Tiene il cursore dello schermino allineato a quello reale (tap,
        // frecce, selezione da tastiera fisica).
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        {...props}
      />
      {isExpression && evaluatedCents !== null && (
        <p className="text-muted-foreground mt-1 text-sm">
          = {formatEuro(evaluatedCents / 100)}
        </p>
      )}
      {keypadOpen &&
        !disabled &&
        createPortal(
          // Bottom sheet fisso in fondo allo schermo (sopra i Dialog, z-50).
          // Niente backdrop: il tap su un altro campo deve spostare subito il
          // focus, e la chiusura è già gestita dal blur / tasto "Fine" / Esc.
          <div
            className="bg-card animate-in slide-in-from-bottom pb-[env(safe-area-inset-bottom)] fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-sm rounded-t-lg border shadow-lg duration-200"
            onPointerDown={(e) => e.preventDefault()}
          >
            {/* Schermino stile calcolatrice CRT: il campo editato può finire
                sotto lo sheet, quindi il valore si legge (e si edita) qui.
                Il cursore lampeggiante è quello reale: il tap su una cifra
                sposta il caret (metà sinistra = prima, metà destra = dopo). */}
            <div className="bg-background rounded-t-lg border-b px-4 py-3" aria-live="polite">
              <p
                ref={displayRef}
                className={cn(
                  'font-crt cursor-text overflow-x-auto text-right text-4xl whitespace-nowrap',
                  value ? 'text-primary crt-glow' : 'text-muted-foreground/50',
                )}
                // Tap sullo spazio vuoto: cursore in fondo.
                onClick={(e) => {
                  if (e.target === e.currentTarget) moveCaret(value.length)
                }}
              >
                {/* Il ▌ di .cursor-blink::after si appoggia alla fine del primo
                    span, cioè esattamente alla posizione del caret. */}
                <span className="cursor-blink">
                  {value.slice(0, caretPos).split('').map((ch, i) => (
                    <span key={i} onClick={(e) => handleDisplayCharClick(e, i)}>
                      {ch}
                    </span>
                  ))}
                </span>
                {(value || '0').slice(caretPos).split('').map((ch, i) => (
                  <span key={caretPos + i} onClick={(e) => handleDisplayCharClick(e, caretPos + i)}>
                    {ch}
                  </span>
                ))}
              </p>
              <p className="text-muted-foreground h-6 text-right text-lg">
                {evaluatedCents !== null ? `= ${formatEuro(evaluatedCents / 100)}` : ''}
              </p>
            </div>
            <NumericKeypad onKey={handleKey} />
          </div>,
          document.body,
        )}
    </div>
  )
}
