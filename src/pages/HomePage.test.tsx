import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import HomePage from './HomePage'
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

const balance = { userId: 1, username: 'mario', totalPaid: 50, totalOwed: 30, netBalance: 20 }

const settlements = [
  // Debito di gruppo verso luigi.
  {
    counterparty: { userId: 2, username: 'luigi', email: 'luigi@example.com' },
    amount: 10,
    direction: 'DEBT',
    groupId: 5,
    groupName: 'Vacanze',
  },
  // Debito personale verso anna.
  {
    counterparty: { userId: 3, username: 'anna', email: 'anna@example.com' },
    amount: 4,
    direction: 'DEBT',
    groupId: null,
    groupName: null,
  },
  // Credito: paolo deve a me — niente azione di rimborso.
  {
    counterparty: { userId: 4, username: 'paolo', email: 'paolo@example.com' },
    amount: 7.5,
    direction: 'CREDIT',
    groupId: null,
    groupName: null,
  },
]

const payments = {
  content: [
    // Io payer: rimborso di gruppo a luigi.
    {
      paymentId: 1,
      payer: { userId: 1, username: 'mario' },
      payee: { userId: 2, username: 'luigi' },
      groupId: 5,
      amount: 10,
      date: '2026-08-15',
      notes: 'parziale',
    },
    // Io payee: rimborso personale da luigi.
    {
      paymentId: 2,
      payer: { userId: 2, username: 'luigi' },
      payee: { userId: 1, username: 'mario' },
      groupId: null,
      amount: 5,
      date: '2026-08-16',
      notes: '',
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

// Il testo delle righe è spezzato in più span e formatEuro usa spazi
// non separabili (NBSP): confronto sul textContent del <p> normalizzato.
const byText = (text: string) =>
  screen.getByText(
    (_, el) => el?.tagName === 'P' && el.textContent?.replace(/\s+/g, ' ').trim() === text,
  )

function mockApi({
  balanceData = balance,
  settlementsData = settlements,
  requestsCount = 0,
}: {
  balanceData?: object
  settlementsData?: object[]
  requestsCount?: number
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/balance/me') return Promise.resolve({ data: balanceData })
    if (url === '/balance/settlements') return Promise.resolve({ data: settlementsData })
    if (url === '/user/friendshipRequests/count')
      return Promise.resolve({ data: { count: requestsCount } })
    if (url === '/payments') return Promise.resolve({ data: payments })
    return Promise.reject(new Error(`GET non mockata: ${url}`))
  })
}

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/']}>
          <HomePage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi()
})

describe('HomePage', () => {
  it('mostra saluto, saldo globale e il "chi deve a chi" completo', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Ciao, mario' })
    expect(screen.getByText('Il tuo saldo globale')).toBeTruthy()
    expect(screen.getByText('20,00 €')).toBeTruthy()
    expect(screen.getByText('Nel complesso ti devono soldi')).toBeTruthy()
    expect(byText('Pagato 50,00 € · Dovuto 30,00 €')).toBeTruthy()
    // Tutti i settlement sono visibili (niente più limite "in evidenza").
    expect(byText('Devi 10,00 € a luigi')).toBeTruthy()
    expect(screen.getByText('gruppo: Vacanze')).toBeTruthy()
    expect(byText('Devi 4,00 € a anna')).toBeTruthy()
    expect(byText('paolo ti deve 7,50 €')).toBeTruthy()
    expect(screen.getAllByText('personale')).toHaveLength(2)
    // Rimborsa solo sui DEBT: luigi e anna, non paolo.
    expect(screen.getAllByRole('button', { name: 'Rimborsa' })).toHaveLength(2)
    // Nessuna richiesta di amicizia: niente box dedicato.
    expect(screen.queryByText(/richieste? di amicizia/)).toBeNull()
  })

  it('mostra lo stato vuoto senza debiti né crediti', async () => {
    mockApi({ settlementsData: [] })
    renderPage()

    await screen.findByText('Nessun debito o credito aperto.')
  })

  it('mostra il box delle richieste di amicizia in attesa', async () => {
    mockApi({ requestsCount: 2 })
    renderPage()

    await screen.findByText(
      (_, el) => el?.tagName === 'P' && el.textContent === 'Hai 2 richieste di amicizia in attesa',
    )
  })

  it('non carica la cronologia finché non si apre la tab', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Ciao, mario' })
    expect(mockedGet).not.toHaveBeenCalledWith('/payments', expect.anything())

    fireEvent.click(screen.getByRole('tab', { name: 'Cronologia' }))

    expect(
      await screen.findByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent?.replace(/\s+/g, ' ').trim() === 'Hai rimborsato 10,00 € a luigi',
      ),
    ).toBeTruthy()
    expect(byText('luigi ti ha rimborsato 5,00 €')).toBeTruthy()
    expect(byText('15 ago 2026 · di gruppo · parziale')).toBeTruthy()
    expect(byText('16 ago 2026 · personale')).toBeTruthy()
    expect(mockedGet).toHaveBeenCalledWith('/payments', { params: { page: 0, size: 20 } })
  })

  it('rimborsa un debito di gruppo passando il groupId', async () => {
    mockedPost.mockResolvedValue({ data: { paymentId: 1 } })
    renderPage()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Rimborsa' }))[0])

    // Importo pre-compilato al massimo del debito.
    expect(await screen.findByLabelText('Importo (€)')).toHaveProperty('value', '10,00')
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'parziale' } })
    fireEvent.submit(document.querySelector('[data-slot="dialog-content"] form')!)

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/payments', null, {
        params: { payeeId: 2, amount: 10, groupId: 5, notes: 'parziale' },
      }),
    )
  })

  it('rimborsa un debito personale senza groupId', async () => {
    mockedPost.mockResolvedValue({ data: { paymentId: 2 } })
    renderPage()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Rimborsa' }))[1])
    await screen.findByLabelText('Importo (€)')
    fireEvent.submit(document.querySelector('[data-slot="dialog-content"] form')!)

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/payments', null, {
        params: { payeeId: 3, amount: 4 },
      }),
    )
  })

  it('al 409 mostra il messaggio del backend nel dialog', async () => {
    mockedPost.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Importo superiore al debito effettivo' } },
    })
    renderPage()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Rimborsa' }))[0])
    await screen.findByLabelText('Importo (€)')
    fireEvent.submit(document.querySelector('[data-slot="dialog-content"] form')!)

    await screen.findByText('Importo superiore al debito effettivo')
  })

  it('controparte eliminata (CREDIT): icona, dialog e "Dimentica il debito"', async () => {
    mockedPost.mockResolvedValue({ data: { paymentId: 3 } })
    mockApi({
      settlementsData: [
        {
          counterparty: { userId: 9, username: 'UtenteEliminato', deleted: true },
          amount: 12,
          direction: 'CREDIT',
          groupId: 5,
          groupName: 'Vacanze',
        },
      ],
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Utente eliminato' }))

    expect(await screen.findByText(/ha eliminato il proprio account/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dimentica il debito' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/payments/forgive', null, {
        params: { payerId: 9, groupId: 5 },
      }),
    )
  })

  it('controparte eliminata (DEBT): dialog senza "Dimentica il debito"', async () => {
    mockApi({
      settlementsData: [
        {
          counterparty: { userId: 9, username: 'UtenteEliminato', deleted: true },
          amount: 12,
          direction: 'DEBT',
          groupId: null,
          groupName: null,
        },
      ],
    })
    renderPage()

    // Il rimborso resta disponibile come prima.
    expect(await screen.findByRole('button', { name: 'Rimborsa' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Utente eliminato' }))

    expect(await screen.findByText(/ha eliminato il proprio account/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dimentica il debito' })).toBeNull()
  })
})
