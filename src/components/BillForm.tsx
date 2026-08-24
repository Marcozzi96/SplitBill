import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatEuro, parseAmountToCents, splitEqually } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/auth-context'
import type { components } from '@/api/types'

type GroupMemberDTO = components['schemas']['GroupMemberDTO']
type BillDTO = components['schemas']['BillDTO']

export interface BillFormValues {
  description: string
  notes: string
  amountCents: number
  /** Chi ha pagato (default: utente corrente) */
  buyerId: number
  /** userId -> quota in centesimi (membri deselezionati o con quota zero/vuota esclusi) */
  sharesCents: Record<number, number>
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

// Ricostruisce le quote (positive, in centesimi) dalle transazioni della spesa.
// Le transazioni sono con segno: il buyer ha il CREDITO (+, somma dei debiti
// altrui), i debitori il DEBITO (-). La quota del buyer si ricava per
// differenza: importo totale - credito.
function initialSharesCents(bill: BillDTO): Record<number, number> {
  const buyerId = bill.buyer?.userId
  const billCents = Math.round((bill.amount ?? 0) * 100)
  const result: Record<number, number> = {}
  for (const t of bill.transactions ?? []) {
    if (t.userId == null || t.amount == null) continue
    const cents = Math.round(t.amount * 100)
    const quotaCents = t.userId === buyerId ? billCents - cents : -cents
    if (quotaCents > 0) result[t.userId] = quotaCents
  }
  return result
}

// Form condiviso tra creazione e modifica (modali in dettaglio gruppo/amico).
// Ogni membro ha una checkbox: solo i partecipanti selezionati entrano nella
// ripartizione (default: tutti; in modifica, chi ha già una quota).
// Il buyer può essere tra i debitori.
export default function BillForm({
  members,
  bill,
  submitLabel,
  isPending,
  error,
  onSubmit,
}: {
  members: GroupMemberDTO[]
  /** Se presente, il form è in modifica e viene precompilato dalla spesa. */
  bill?: BillDTO
  submitLabel: string
  isPending: boolean
  error?: string | null
  onSubmit: (values: BillFormValues) => void
}) {
  const { user } = useAuth()
  const [description, setDescription] = useState(bill?.description ?? '')
  const [notes, setNotes] = useState(bill?.notes ?? '')
  const [amount, setAmount] = useState(
    bill?.amount != null ? centsToInput(Math.round(bill.amount * 100)) : '',
  )
  const [shares, setShares] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {}
    for (const [userId, cents] of Object.entries(bill ? initialSharesCents(bill) : {})) {
      initial[Number(userId)] = centsToInput(cents)
    }
    return initial
  })
  // Membri con account eliminato: non possono essere aggiunti a nuove spese.
  // In modifica restano selezionabili solo se hanno già una quota nella spesa
  // (il backend accetta i deleted preesistenti); il buyer attuale resta
  // comunque selezionabile in "Pagato da" (vedi buyerOptions).
  const preexistingShareIds = new Set(
    bill ? Object.keys(initialSharesCents(bill)).map(Number) : [],
  )
  const isLocked = (m: GroupMemberDTO) =>
    m.deleted === true && !preexistingShareIds.has(m.userId!)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    if (bill) {
      // In modifica sono preselezionati i partecipanti con quota > 0.
      const withShare = new Set(
        Object.keys(initialSharesCents(bill)).map(Number),
      )
      if (withShare.size > 0) return withShare
    }
    return new Set(members.filter((m) => !isLocked(m)).map((m) => m.userId!))
  })
  const [localError, setLocalError] = useState<string | null>(null)
  // Chi ha pagato: default l'utente corrente (in modifica, il buyer della spesa).
  const [buyerId, setBuyerId] = useState<number | null>(
    bill?.buyer?.userId ?? user?.userId ?? null,
  )

  const amountCents = parseAmountToCents(amount)
  // Solo i partecipanti selezionati entrano nel conteggio delle quote.
  const parsedShares = members
    .filter((m) => selectedIds.has(m.userId!))
    .map((m) => ({
      userId: m.userId!,
      cents: parseAmountToCents(shares[m.userId!] ?? ''),
      raw: shares[m.userId!] ?? '',
    }))
  const sumCents = parsedShares.reduce((sum, s) => sum + (s.cents ?? 0), 0)

  // "Pagato da": scegli tra i partecipanti selezionati; il buyer resta
  // selezionabile anche se senza quota (es. ha pagato tutto per un altro).
  const buyerOptions = members.filter((m) => selectedIds.has(m.userId!) || m.userId === buyerId)

  function toggleMember(userId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function handleSplitEqually() {
    if (amountCents === null || amountCents <= 0) {
      setLocalError("Inserisci prima un importo valido")
      return
    }
    if (selectedIds.size === 0) {
      setLocalError('Seleziona almeno un partecipante')
      return
    }
    setLocalError(null)
    const selectedMembers = members.filter((m) => selectedIds.has(m.userId!))
    const parts = splitEqually(amountCents, selectedMembers.length)
    const next: Record<number, string> = {}
    selectedMembers.forEach((m, i) => {
      next[m.userId!] = centsToInput(parts[i])
    })
    setShares(next)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)

    if (!description.trim()) {
      setLocalError('Inserisci una descrizione')
      return
    }
    if (amountCents === null || amountCents <= 0) {
      setLocalError('Inserisci un importo valido (es. 42,50)')
      return
    }
    if (selectedIds.size === 0) {
      setLocalError('Seleziona almeno un partecipante')
      return
    }
    if (buyerId == null) {
      setLocalError('Seleziona chi ha pagato')
      return
    }
    if (parsedShares.some((s) => s.raw.trim() !== '' && s.cents === null)) {
      setLocalError('Controlla le quote: ci sono valori non validi')
      return
    }
    // Regola del backend: la somma delle quote deve pareggiare esattamente l'importo.
    if (sumCents !== amountCents) {
      setLocalError(
        `La somma delle quote (${formatEuro(sumCents / 100)}) non pareggia l'importo (${formatEuro(amountCents / 100)})`,
      )
      return
    }

    const sharesCents: Record<number, number> = {}
    for (const s of parsedShares) {
      if (s.cents !== null && s.cents > 0) sharesCents[s.userId] = s.cents
    }
    onSubmit({ description: description.trim(), notes: notes.trim(), amountCents, buyerId, sharesCents })
  }

  const remainingCents = amountCents !== null ? amountCents - sumCents : null

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="billDescription">Descrizione</FieldLabel>
          <Input
            id="billDescription"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="billAmount">Importo (€)</FieldLabel>
          <Input
            id="billAmount"
            required
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="billNotes">Note</FieldLabel>
          <Input id="billNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="billBuyer">Pagato da</FieldLabel>
          <select
            id="billBuyer"
            className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base md:text-sm"
            value={buyerId ?? ''}
            onChange={(e) => setBuyerId(Number(e.target.value))}
          >
            {buyerOptions.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.username}
                {m.userId === user?.userId ? ' (Tu)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel>Ripartizione</FieldLabel>
            <Button type="button" variant="outline" size="sm" onClick={handleSplitEqually}>
              Dividi equamente
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {members.map((member) => {
              const selected = selectedIds.has(member.userId!)
              const locked = isLocked(member)
              return (
                <div key={member.userId} className="flex items-center justify-between gap-2">
                  <label
                    className={cn(
                      'flex min-h-11 min-w-0 flex-1 items-center gap-2',
                      locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0"
                      checked={selected}
                      disabled={locked}
                      onChange={() => toggleMember(member.userId!)}
                      aria-label={`Partecipa ${member.username}`}
                    />
                    <span className="min-w-0 truncate text-sm">
                      {member.username}
                      {member.userId === user?.userId && ' (Tu)'}
                    </span>
                  </label>
                  <Input
                    className="w-28 text-right"
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={`Quota ${member.username}`}
                    disabled={!selected}
                    value={shares[member.userId!] ?? ''}
                    onChange={(e) =>
                      setShares((prev) => ({ ...prev, [member.userId!]: e.target.value }))
                    }
                  />
                </div>
              )
            })}
          </div>
          {remainingCents !== null && (
            <p className="text-muted-foreground text-sm">
              {remainingCents === 0
                ? 'Quote bilanciate'
                : remainingCents > 0
                  ? `Mancano ${formatEuro(remainingCents / 100)} da assegnare`
                  : `${formatEuro(-remainingCents / 100)} in eccesso`}
            </p>
          )}
        </Field>

        {(localError ?? error) && <FieldError>{localError ?? error}</FieldError>}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Salvataggio in corso…' : submitLabel}
        </Button>
      </FieldGroup>
    </form>
  )
}
