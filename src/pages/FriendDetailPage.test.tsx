import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FriendDetailPage from './FriendDetailPage'
import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import { api } from '@/api/client'

vi.mock('@/api/client', () => ({
  TOKEN_KEY: 'splitbill_token',
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

const mockedGet = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)
const mockedPut = vi.mocked(api.put)
const mockedDelete = vi.mocked(api.delete)

const friendsPage = {
  content: [{ userId: 2, username: 'luigi', email: 'luigi@example.com' }],
  totalPages: 1,
  number: 0,
}

// Transazioni con segno, come dal backend: debitore negativo, credito del buyer positivo.
const myBills = {
  content: [
    // Personale con l'amico come debitore: inclusa (buyer = io).
    {
      billId: 1,
      description: 'Pizza',
      amount: 20,
      notes: '',
      groupId: null,
      buyer: { userId: 1, username: 'mario' },
      transactions: [
        { userId: 2, amount: -10 },
        { userId: 1, amount: 10 },
      ],
      creationDate: '2026-08-10',
    },
    // Spesa di gruppo con l'amico: esclusa.
    {
      billId: 2,
      description: 'Gita',
      amount: 50,
      groupId: 5,
      buyer: { userId: 1, username: 'mario' },
      transactions: [{ userId: 2, amount: -25 }],
      creationDate: '2026-08-11',
    },
    // Personale pagata dall'amico: inclusa.
    {
      billId: 3,
      description: 'Cinema',
      amount: 16,
      notes: '',
      groupId: null,
      buyer: { userId: 2, username: 'luigi' },
      transactions: [
        { userId: 1, amount: -8 },
        { userId: 2, amount: 8 },
      ],
      creationDate: '2026-08-12',
    },
    // Personale con un altro amico: esclusa.
    {
      billId: 4,
      description: 'Taxi',
      amount: 30,
      groupId: null,
      buyer: { userId: 1, username: 'mario' },
      transactions: [{ userId: 3, amount: -15 }],
      creationDate: '2026-08-13',
    },
  ],
  totalPages: 1,
  number: 0,
}

const authValue: AuthContextValue = {
  user: { userId: 1, username: 'mario', email: 'mario@example.com' },
  token: 'token',
  isLoading: false,
  isError: false,
  retryFetchUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}

function renderPage(entry = '/friends/2') {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/friends" element={<p>Lista amici</p>} />
            <Route path="/friends/:userId" element={<FriendDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGet.mockImplementation((url: string) => {
    if (url === '/user/getFriends') return Promise.resolve({ data: friendsPage })
    if (url === '/bills/getMyBills') return Promise.resolve({ data: myBills })
    return Promise.reject(new Error(`GET non mockata: ${url}`))
  })
})

describe('FriendDetailPage', () => {
  it('mostra solo le spese senza gruppo condivise con l’amico', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'luigi' })).toBeTruthy()
    expect(await screen.findByText('Pizza')).toBeTruthy()
    expect(screen.getByText('Cinema')).toBeTruthy()
    expect(screen.queryByText('Gita')).toBeNull()
    expect(screen.queryByText('Taxi')).toBeNull()
  })

  it('mostra lo stato vuoto se non ci sono spese condivise', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/user/getFriends') return Promise.resolve({ data: friendsPage })
      if (url === '/bills/getMyBills')
        return Promise.resolve({ data: { content: [], totalPages: 1, number: 0 } })
      return Promise.reject(new Error(`GET non mockata: ${url}`))
    })
    renderPage()

    await screen.findByText('Nessuna spesa condivisa con luigi.')
  })

  it('il pulsante Nuova spesa apre il modale di creazione', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Nuova spesa/ }))

    // Stesso modale della modifica: campi del BillForm visibili.
    expect(await screen.findByLabelText('Descrizione')).toBeTruthy()
    expect(screen.getByLabelText('Importo (€)')).toBeTruthy()
    expect(screen.getByLabelText('Pagato da')).toBeTruthy()
    // Di default partecipiamo entrambi e "Pagato da" sono io.
    expect(screen.getByLabelText('Partecipa mario')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Pagato da')).toHaveProperty('value', '1')
  })

  it('crea una spesa personale dal modale, con "Pagato da" l’amico', async () => {
    mockedPost.mockResolvedValue({ data: { billId: 50 } })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Nuova spesa/ }))
    await screen.findByLabelText('Descrizione')

    // Ha pagato luigi: il debito è tutto mio.
    fireEvent.change(screen.getByLabelText('Pagato da'), { target: { value: '2' } })
    fireEvent.click(screen.getByLabelText('Partecipa luigi'))
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Concerto' } })
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Quota mario'), { target: { value: '50' } })
    fireEvent.submit(document.querySelector('[data-slot="dialog-content"] form')!)

    // Spesa personale: niente groupId nei params.
    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        '/bills/new',
        { 1: 50 },
        { params: { description: 'Concerto', amount: 50, notes: '', buyerId: 2 } },
      ),
    )
  })

  it('mostra modifica/elimina su tutte le spese condivise (buyer o debitore)', async () => {
    renderPage()

    await screen.findByText('Pizza')
    // Pizza: buyer = io. Cinema: buyer = l'amico. Entrambe gestibili.
    expect(screen.getByRole('button', { name: 'Modifica Pizza' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Elimina Pizza' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Modifica Cinema' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Elimina Cinema' })).toBeTruthy()
  })

  it('modifica una spesa personale con quote precompilate positive', async () => {
    mockedPut.mockResolvedValue({ data: {} })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifica Pizza' }))

    // Quote ricostruite dalle transazioni con segno: entrambi selezionati a 10,00.
    expect(await screen.findByLabelText('Quota luigi')).toHaveProperty('value', '10,00')
    expect(screen.getByLabelText('Quota mario')).toHaveProperty('value', '10,00')
    expect(screen.getByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Partecipa mario')).toHaveProperty('checked', true)
    // Il mio nome è marcato con (Tu): riga partecipante + opzione "Pagato da".
    expect(screen.getAllByText('mario (Tu)')).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Pizza da asporto' } })
    fireEvent.submit(document.querySelector('[data-slot="dialog-content"] form')!)

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/bills/1', { 1: 10, 2: 10 }, {
        params: { description: 'Pizza da asporto', amount: 20, notes: '', buyerId: 1 },
      }),
    )
  })

  it('elimina una spesa personale dopo conferma', async () => {
    mockedDelete.mockResolvedValue({ data: {} })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Elimina Pizza' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina' }))

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('/bills/1'))
  })

  it('cliccando una spesa si apre il dettaglio in sola lettura', async () => {
    renderPage()

    fireEvent.click(await screen.findByText('Pizza'))

    // Modale read-only: quote con nomi risolti, nessun campo del form.
    expect(await screen.findByText('Pagato da')).toBeTruthy()
    expect(screen.getByText('Quote')).toBeTruthy()
    expect(screen.getAllByText(/10,00\s*€/)).toHaveLength(2)
    expect(screen.queryByLabelText('Descrizione')).toBeNull()
  })

  it('i bottoni modifica/elimina non aprono il dettaglio', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifica Pizza' }))

    // Si apre solo il modale di modifica (campi del form), non quello di dettaglio.
    expect(await screen.findByLabelText('Descrizione')).toBeTruthy()
    expect(screen.queryByText('Quote')).toBeNull()
  })
})
