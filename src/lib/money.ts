// Importi a 2 decimali: si lavora in centesimi (interi) per evitare
// gli errori di arrotondamento dei float JSON.

// Colore del saldo netto: positivo = ti devono soldi, negativo = devi soldi.
export function netBalanceClass(net: number): string {
  if (net > 0) return 'text-success'
  if (net < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

export function formatEuro(amount?: number): string {
  return (amount ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

// "12,5" | "12.50" -> 1250 centesimi; null se il formato non è valido.
export function parseAmountToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

// Operatori accettati nelle espressioni (inclusi i simboli unicode inseriti
// dal tastierino: − × ÷).
const OP_MAP: Record<string, '+' | '-' | '*' | '/'> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '×': '*',
  '·': '*',
  '/': '/',
  '÷': '/',
  ':': '/',
}

// Caratteri che rendono il valore un'espressione (attivano anteprima e
// risoluzione in MoneyInput).
export const EXPRESSION_OPERATOR_REGEX = /[+\-*×·/÷:−()]/

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; op: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' }

function tokenizeExpression(text: string): Token[] | null {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === ' ') {
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }
    const op = OP_MAP[ch]
    if (op) {
      tokens.push({ type: 'op', op })
      i++
      continue
    }
    const match = /^\d+(\.\d{1,2})?/.exec(text.slice(i))
    if (!match) return null
    tokens.push({ type: 'num', value: Number(match[0]) })
    i += match[0].length
  }
  return tokens
}

// Valuta un'espressione monetaria tipo "(12,50 + 3) × 2" -> centesimi (null se
// malformata, divisione per zero o risultato negativo). Precedenza standard con
// supporto delle parentesi, niente eval. Ogni operando ha al massimo 2
// decimali; il risultato finale è arrotondato ai centesimi.
export function evaluateMoneyExpression(value: string): number | null {
  const text = value.trim().replace(/,/g, '.')
  if (text === '') return null
  const parsedTokens = tokenizeExpression(text)
  if (!parsedTokens || parsedTokens.length === 0) return null
  // Deve contenere almeno un'operazione o una parentesi, altrimenti è un
  // importo semplice (competenza di parseAmountToCents).
  if (!parsedTokens.some((t) => t.type !== 'num')) return null
  const tokens: Token[] = parsedTokens

  let pos = 0

  function parseExpression(): number | null {
    let left = parseTerm()
    while (left !== null) {
      const token = tokens[pos]
      if (token?.type !== 'op' || (token.op !== '+' && token.op !== '-')) break
      pos++
      const right = parseTerm()
      if (right === null) return null
      left = token.op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm(): number | null {
    let left = parseFactor()
    while (left !== null) {
      const token = tokens[pos]
      if (token?.type !== 'op' || (token.op !== '*' && token.op !== '/')) break
      pos++
      const right = parseFactor()
      if (right === null) return null
      if (token.op === '/' && right === 0) return null
      left = token.op === '*' ? left * right : left / right
    }
    return left
  }

  function parseFactor(): number | null {
    const token = tokens[pos]
    if (token?.type === 'num') {
      pos++
      return token.value
    }
    if (token?.type === 'lparen') {
      pos++
      const inner = parseExpression()
      if (inner === null || tokens[pos]?.type !== 'rparen') return null
      pos++
      return inner
    }
    return null
  }

  const result = parseExpression()
  if (result === null || pos !== tokens.length) return null
  if (!Number.isFinite(result) || result < 0) return null
  return Math.round(result * 100)
}

// Come parseAmountToCents, ma accetta anche espressioni ("10 + 2,50").
export function resolveAmountToCents(value: string): number | null {
  return parseAmountToCents(value) ?? evaluateMoneyExpression(value)
}

// 1550 centesimi -> "15,50" (formato usato negli input monetari).
export function centsToAmountInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

// Ripartizione equa in centesimi: i centesimi di resto vanno ai primi membri.
export function splitEqually(totalCents: number, parts: number): number[] {
  const base = Math.floor(totalCents / parts)
  const remainder = totalCents - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}
