import { useRef, useState, type CSSProperties } from 'react'
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

// Altezza stimata del tastierino per decidere se aprire sotto o sopra il campo.
const KEYPAD_HEIGHT = 320
const KEYPAD_MIN_WIDTH = 280

// Posizione del pop-up: ancorato al campo, centrato orizzontalmente, con flip
// sopra il campo se sotto non c'è spazio. Resta dentro il viewport.
function keypadPosition(input: HTMLInputElement): CSSProperties {
  const rect = input.getBoundingClientRect()
  const width = Math.min(Math.max(rect.width, KEYPAD_MIN_WIDTH), window.innerWidth - 16)
  const left = Math.max(
    8,
    Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8),
  )
  const spaceBelow = window.innerHeight - rect.bottom
  const openBelow = spaceBelow >= KEYPAD_HEIGHT || spaceBelow >= rect.top
  const top = openBelow
    ? rect.bottom + 8
    : Math.max(8, rect.top - KEYPAD_HEIGHT - 8)
  return { position: 'fixed', top, left, width, zIndex: 60 }
}

// Input monetario con tastierino "calcolatrice" custom (stile Satispay):
// inputMode="none" impedisce l'apertura della tastiera di sistema su mobile;
// al focus il tastierino compare come pop-up ancorato al campo (portal su
// document.body: il Dialog ha overflow-hidden e transform, un pop-up interno
// verrebbe tagliato/disancorato). Su desktop la tastiera fisica continua a
// funzionare normalmente. Se il valore è un'espressione ("12,50 + 3") mostra
// l'anteprima del risultato; "=" o il blur la risolvono nel campo.
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
  const [keypadStyle, setKeypadStyle] = useState<CSSProperties | null>(null)

  const keypadOpen = keypadStyle !== null
  const isExpression = EXPRESSION_OPERATOR_REGEX.test(value)
  const evaluatedCents = isExpression ? evaluateMoneyExpression(value) : null

  function openKeypad() {
    if (inputRef.current) setKeypadStyle(keypadPosition(inputRef.current))
    else setKeypadStyle({})
  }

  function closeKeypad() {
    setKeypadStyle(null)
  }

  function resolveExpression() {
    if (!isExpression) return
    const cents = evaluateMoneyExpression(value)
    if (cents !== null) onChange(centsToAmountInput(cents))
  }

  // Inserisce/cancella alla posizione del cursore (fallback: in fondo).
  function insertText(text: string) {
    const el = inputRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    onChange(value.slice(0, start) + text + value.slice(end))
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
        requestAnimationFrame(() => {
          el?.focus()
          el?.setSelectionRange(start - 1, start - 1)
        })
      } else {
        onChange(value.slice(0, start) + value.slice(end))
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
          <div
            style={keypadStyle}
            className="bg-card rounded-lg border shadow-lg"
            onPointerDown={(e) => e.preventDefault()}
          >
            <NumericKeypad onKey={handleKey} />
          </div>,
          document.body,
        )}
    </div>
  )
}
