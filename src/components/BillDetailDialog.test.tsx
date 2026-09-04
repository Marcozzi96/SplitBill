import { render, screen, fireEvent } from '@testing-library/react'
import BillDetailDialog from './BillDetailDialog'
import type { components } from '@/api/types'

type BillDTO = components['schemas']['BillDTO']

// Transazioni con segno, come dal backend: debitore negativo, credito del buyer positivo.
const bill: BillDTO = {
  billId: 1,
  description: 'Pizza',
  amount: 20,
  notes: 'Da asporto, senza glutine',
  buyer: { userId: 1, username: 'mario' },
  transactions: [
    { transactionId: 11, userId: 2, amount: -10 },
    { transactionId: 12, userId: 1, amount: 10 },
  ],
  creationDate: '2026-08-10',
}

const resolveUsername = (userId: number) =>
  ({ 1: 'mario', 2: 'luigi' })[userId] ?? 'UtenteEliminato'

function renderDialog(overrides?: Partial<BillDTO>) {
  return render(
    <BillDetailDialog
      bill={{ ...bill, ...overrides }}
      open
      onOpenChange={() => {}}
      resolveUsername={resolveUsername}
    />,
  )
}

describe('BillDetailDialog', () => {
  it('mostra descrizione, data, contesto, importo e buyer', () => {
    renderDialog()

    expect(screen.getByText('Pizza')).toBeTruthy()
    expect(screen.getByText(/10 ago 2026 · Personale/)).toBeTruthy()
    // "20,00 €" appare due volte: importo in evidenza e riga "Totale ripartito".
    expect(screen.getAllByText(/20,00\s*€/)).toHaveLength(2)
    expect(screen.getByText('Pagato da')).toBeTruthy()
    // "mario" appare due volte: buyer e riga della sua quota.
    expect(screen.getAllByText('mario')).toHaveLength(2)
  })

  it('mostra il contesto Gruppo per le spese con groupId', () => {
    renderDialog({ groupId: 5 })

    expect(screen.getByText(/10 ago 2026 · Gruppo/)).toBeTruthy()
  })

  it('mostra le note complete solo se presenti', () => {
    const { unmount } = renderDialog()
    expect(screen.getByText('Da asporto, senza glutine')).toBeTruthy()
    unmount()

    renderDialog({ notes: '' })
    expect(screen.queryByText('Note')).toBeNull()
  })

  it('mostra gli articoli acquistati solo se presenti', () => {
    const { unmount } = renderDialog()
    expect(screen.queryByText('Articoli acquistati')).toBeNull()
    unmount()

    renderDialog({ purchasedItems: 'Latte, Uova (x6)' })
    expect(screen.getByText('Articoli acquistati')).toBeTruthy()
    expect(screen.getByText('Latte, Uova (x6)')).toBeTruthy()
  })

  it('mostra le quote con i nomi risolti e gli importi positivi', () => {
    renderDialog()

    expect(screen.getByText('Quote')).toBeTruthy()
    expect(screen.getByText('luigi')).toBeTruthy()
    // Debitore: -10 → quota 10. Buyer: credito 10 su 20 → quota 10.
    expect(screen.getAllByText(/10,00\s*€/)).toHaveLength(2)
  })

  it('mostra il riepilogo quote: numero partecipanti e totale ripartito', () => {
    renderDialog()

    expect(screen.getByText('2 partecipanti')).toBeTruthy()
    expect(screen.getByText('Totale ripartito')).toBeTruthy()
  })

  it('usa il fallback di resolveUsername per gli userId sconosciuti', () => {
    renderDialog({ transactions: [{ transactionId: 13, userId: 99, amount: -20 }] })

    expect(screen.getByText('UtenteEliminato')).toBeTruthy()
  })

  it('chiama onOpenChange alla chiusura', () => {
    const onOpenChange = vi.fn()
    render(
      <BillDetailDialog bill={bill} open onOpenChange={onOpenChange} resolveUsername={resolveUsername} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  })
})
