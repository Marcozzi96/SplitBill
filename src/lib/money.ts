// Importi a 2 decimali: si lavora in centesimi (interi) per evitare
// gli errori di arrotondamento dei float JSON.

export function formatEuro(amount?: number): string {
  return (amount ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

// "12,5" | "12.50" -> 1250 centesimi; null se il formato non è valido.
export function parseAmountToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

// Ripartizione equa in centesimi: i centesimi di resto vanno ai primi membri.
export function splitEqually(totalCents: number, parts: number): number[] {
  const base = Math.floor(totalCents / parts)
  const remainder = totalCents - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}
