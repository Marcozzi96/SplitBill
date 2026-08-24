import { render, screen, fireEvent, within } from '@testing-library/react'
import BillForm, { type BillFormValues } from './BillForm'
import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import type { components } from '@/api/types'

type GroupMemberDTO = components['schemas']['GroupMemberDTO']
type BillDTO = components['schemas']['BillDTO']

const members: GroupMemberDTO[] = [
  { userId: 1, username: 'mario', email: 'mario@example.com' },
  { userId: 2, username: 'luigi', email: 'luigi@example.com' },
  { userId: 3, username: 'anna', email: 'anna@example.com' },
]

// Membro con account eliminato (anonimizzato dal backend).
const membersWithDeleted: GroupMemberDTO[] = [
  ...members,
  { userId: 4, username: 'UtenteEliminato', deleted: true },
]

const authValue: AuthContextValue = {
  user: { userId: 1, username: 'mario', email: 'mario@example.com' },
  token: 'token',
  isLoading: false,
  isError: false,
  retryFetchUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}

function renderForm(
  props: {
    bill?: BillDTO
    members?: GroupMemberDTO[]
    onSubmit?: (values: BillFormValues) => void
  } = {},
) {
  const onSubmit = props.onSubmit ?? vi.fn()
  render(
    <AuthContext.Provider value={authValue}>
      <BillForm
        members={props.members ?? members}
        bill={props.bill}
        submitLabel="Crea spesa"
        isPending={false}
        onSubmit={onSubmit}
      />
    </AuthContext.Provider>,
  )
  return onSubmit
}

function submit() {
  fireEvent.submit(document.querySelector('form')!)
}

describe('BillForm', () => {
  it('di default tutti i partecipanti sono selezionati', () => {
    renderForm()

    expect(screen.getByLabelText('Partecipa mario')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Partecipa anna')).toHaveProperty('checked', true)
  })

  it('"Dividi equamente" divide solo tra i selezionati', () => {
    renderForm()

    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '10' } })
    fireEvent.click(screen.getByLabelText('Partecipa anna'))
    fireEvent.click(screen.getByRole('button', { name: 'Dividi equamente' }))

    expect(screen.getByLabelText('Quota mario')).toHaveProperty('value', '5,00')
    expect(screen.getByLabelText('Quota luigi')).toHaveProperty('value', '5,00')
    // La quota del deselezionato resta vuota e disabilitata.
    expect(screen.getByLabelText('Quota anna')).toHaveProperty('value', '')
    expect(screen.getByLabelText('Quota anna')).toHaveProperty('disabled', true)
  })

  it('la somma delle quote conta solo i selezionati: i deselezionati sono esclusi', () => {
    const onSubmit = renderForm()

    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Pizza' } })
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '10' } })
    // Quota "sporca" su anna, poi la deseleziono: non deve contare.
    fireEvent.change(screen.getByLabelText('Quota anna'), { target: { value: '8' } })
    fireEvent.click(screen.getByLabelText('Partecipa anna'))
    fireEvent.click(screen.getByLabelText('Partecipa luigi'))
    fireEvent.change(screen.getByLabelText('Quota mario'), { target: { value: '10' } })
    submit()

    expect(onSubmit).toHaveBeenCalledWith({
      description: 'Pizza',
      notes: '',
      amountCents: 1000,
      buyerId: 1,
      sharesCents: { 1: 1000 },
    })
  })

  it('blocca l’invio se la somma delle quote dei selezionati non pareggia', () => {
    const onSubmit = renderForm()

    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Pizza' } })
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Quota mario'), { target: { value: '4' } })
    submit()

    expect(screen.getByText(/non pareggia l'importo/)).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('richiede almeno un partecipante', () => {
    const onSubmit = renderForm()

    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Pizza' } })
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '10' } })
    for (const name of ['mario', 'luigi', 'anna']) {
      fireEvent.click(screen.getByLabelText(`Partecipa ${name}`))
    }
    submit()

    expect(screen.getByText('Seleziona almeno un partecipante')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('in modifica preseleziona solo i membri con quota', () => {
    // Spesa da 10€ pagata da mario, tutta a carico di luigi:
    // il credito del buyer pareggia l'importo → quota del buyer = 0.
    const bill: BillDTO = {
      billId: 1,
      description: 'Cinema',
      amount: 10,
      notes: '',
      buyer: { userId: 1, username: 'mario' },
      transactions: [
        { userId: 2, amount: -10 },
        { userId: 1, amount: 10 },
      ],
    }
    renderForm({ bill })

    expect(screen.getByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Partecipa mario')).toHaveProperty('checked', false)
    expect(screen.getByLabelText('Partecipa anna')).toHaveProperty('checked', false)
    // Il buyer resta selezionabile in "Pagato da" anche senza quota.
    expect(screen.getByLabelText('Pagato da')).toHaveProperty('value', '1')
  })

  it('in creazione un membro eliminato non è selezionabile né tra i "Pagato da"', () => {
    renderForm({ members: membersWithDeleted })

    const checkbox = screen.getByLabelText('Partecipa UtenteEliminato')
    expect(checkbox).toHaveProperty('checked', false)
    expect(checkbox).toHaveProperty('disabled', true)
    // Gli altri membri restano selezionati di default.
    expect(screen.getByLabelText('Partecipa mario')).toHaveProperty('checked', true)
    // Escluso dalle opzioni "Pagato da".
    const buyerSelect = screen.getByLabelText('Pagato da')
    expect(within(buyerSelect).queryByRole('option', { name: 'UtenteEliminato' })).toBeNull()
  })

  it('in modifica un eliminato con quota preesistente resta selezionato ed editabile', () => {
    // Spesa da 10€ pagata da mario: 4€ a carico dell'eliminato, 6€ di luigi.
    const bill: BillDTO = {
      billId: 2,
      description: 'Cena',
      amount: 10,
      notes: '',
      buyer: { userId: 1, username: 'mario' },
      transactions: [
        { userId: 4, amount: -4 },
        { userId: 2, amount: -6 },
        { userId: 1, amount: 10 },
      ],
    }
    renderForm({ bill, members: membersWithDeleted })

    const checkbox = screen.getByLabelText('Partecipa UtenteEliminato')
    expect(checkbox).toHaveProperty('checked', true)
    expect(checkbox).toHaveProperty('disabled', false)
    expect(screen.getByLabelText('Quota UtenteEliminato')).toHaveProperty('value', '4,00')
  })
})
