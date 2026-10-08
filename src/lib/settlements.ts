import type { components } from '@/api/types'

type UserSettlementDTO = components['schemas']['UserSettlementDTO']

// Aggregazione dei settlement globali (/balance/settlements) per le liste
// Amici/Gruppi: DEBT pesa negativo (devi), CREDIT positivo (ti devono).
// Le somme sono arrotondate ai centesimi per evitare errori float.

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function addTo(map: Map<number, number>, key: number, settlement: UserSettlementDTO) {
  const signed = settlement.direction === 'CREDIT' ? (settlement.amount ?? 0) : -(settlement.amount ?? 0)
  map.set(key, round2((map.get(key) ?? 0) + signed))
}

// Saldo netto PERSONALE per amico (solo settlement senza gruppo).
export function netByFriend(settlements: UserSettlementDTO[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const s of settlements) {
    if (s.groupId != null || s.counterparty?.userId == null) continue
    addTo(map, s.counterparty.userId, s)
  }
  return map
}

// Saldo netto per gruppo (somma dei settlement con quel groupId).
export function netByGroup(settlements: UserSettlementDTO[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const s of settlements) {
    if (s.groupId == null) continue
    addTo(map, s.groupId, s)
  }
  return map
}

// Ordinamento delle liste: prima chi ha un saldo aperto (per importo
// assoluto decrescente), poi gli "in pari" in ordine alfabetico.
export function byOpenBalance<T>(
  items: T[],
  netOf: (item: T) => number,
  nameOf: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const diff = Math.abs(netOf(b)) - Math.abs(netOf(a))
    return diff !== 0 ? diff : nameOf(a).localeCompare(nameOf(b), 'it')
  })
}
