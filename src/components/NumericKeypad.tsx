import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

export type KeypadKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | ','
  | '+' | '−' | '×' | '÷'
  | '(' | ')'
  | 'backspace'
  | 'equals'
  | 'done'

const ARIA_LABELS: Partial<Record<KeypadKey, string>> = {
  ',': 'Virgola',
  '+': 'Più',
  '−': 'Meno',
  '×': 'Per',
  '÷': 'Diviso',
  '(': 'Parentesi aperta',
  ')': 'Parentesi chiusa',
  backspace: 'Cancella',
}

// Righe della griglia 4x4: cifre in stile telefono (1-2-3 in alto), ultima
// riga ", 0 ⌫" e colonna destra con gli operatori in rosso, come Satispay.
const ROWS: KeypadKey[][] = [
  ['1', '2', '3', '+'],
  ['4', '5', '6', '−'],
  ['7', '8', '9', '×'],
  [',', '0', 'backspace', '÷'],
]

const KEY_CLASS =
  'bg-background hover:bg-accent active:bg-accent/80 flex h-11 min-w-11 items-center justify-center rounded-md border text-lg font-medium transition-colors select-none'

// Tastierino "calcolatrice" stile Satispay (resa pop-up gestita da MoneyInput).
// I tasti usano onPointerDown+preventDefault per non rubare il focus all'input.
export function NumericKeypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  return (
    <div className="p-2">
      <div className="flex flex-col gap-2">
        {ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-2">
            {row.map((key) => {
              const isOperator = key === '+' || key === '−' || key === '×' || key === '÷'
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={ARIA_LABELS[key]}
                  className={cn(KEY_CLASS, isOperator && 'text-destructive text-xl')}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onKey(key)}
                >
                  {key === 'backspace' ? <Delete className="size-5" aria-hidden /> : key}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {(['(', ')'] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-label={ARIA_LABELS[key]}
            className={KEY_CLASS}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onKey(key)}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          aria-label="Uguale"
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-11 items-center justify-center rounded-md text-lg font-semibold transition-colors select-none"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onKey('equals')}
        >
          =
        </button>
        <button
          type="button"
          className="hover:bg-accent active:bg-accent/80 flex h-11 items-center justify-center rounded-md border text-base font-medium transition-colors select-none"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onKey('done')}
        >
          Fine
        </button>
      </div>
    </div>
  )
}
