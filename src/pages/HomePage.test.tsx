import { render, screen } from '@testing-library/react'
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

const balance = { userId: 1, username: 'mario', totalPaid: 50, totalOwed: 60, netBalance: -10 }

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
  settlements = [],
  requestsCount = 0,
}: {
  balanceData?: object
  settlements?: object[]
  requestsCount?: number
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/balance/me') return Promise.resolve({ data: balanceData })
    if (url === '/balance/settlements') return Promise.resolve({ data: settlements })
    if (url === '/user/friendshipRequests/count')
      return Promise.resolve({ data: { count: requestsCount } })
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
  it('mostra saluto, saldo globale e stato vuoto dei settlement', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Ciao, mario' })
    expect(screen.getByText('Il tuo saldo globale')).toBeTruthy()
    expect(screen.getByText('-10,00 €')).toBeTruthy()
    expect(screen.getByText('Nel complesso devi soldi')).toBeTruthy()
    expect(screen.getByText('Nessun debito o credito aperto.')).toBeTruthy()
    // Nessuna richiesta di amicizia: niente box dedicato.
    expect(screen.queryByText(/richieste? di amicizia/)).toBeNull()
  })

  it('mostra in evidenza al massimo 3 settlement con link ai bilanci', async () => {
    mockApi({
      settlements: [
        { counterparty: { userId: 2, username: 'u2' }, amount: 1, direction: 'DEBT', groupId: null, groupName: null },
        { counterparty: { userId: 3, username: 'u3' }, amount: 2, direction: 'DEBT', groupId: 5, groupName: 'Vacanze' },
        { counterparty: { userId: 4, username: 'u4' }, amount: 3, direction: 'CREDIT', groupId: null, groupName: null },
        { counterparty: { userId: 5, username: 'u5' }, amount: 4, direction: 'DEBT', groupId: null, groupName: null },
      ],
    })
    renderPage()

    await screen.findByText('u2')
    expect(byText('Devi 1,00 € a u2')).toBeTruthy()
    expect(byText('Devi 2,00 € a u3')).toBeTruthy()
    expect(byText('u4 ti deve 3,00 €')).toBeTruthy()
    // Il quarto settlement resta nella pagina Bilanci.
    expect(screen.queryByText('u5')).toBeNull()
    // Il link "Vedi tutti" porta ai bilanci (Base UI: <a> con role button).
    const link = screen.getByText('Vedi tutti').closest('a')
    expect(link?.getAttribute('href')).toBe('/balances')
  })

  it('mostra il box delle richieste di amicizia in attesa', async () => {
    mockApi({ requestsCount: 2 })
    renderPage()

    await screen.findByText(
      (_, el) => el?.tagName === 'P' && el.textContent === 'Hai 2 richieste di amicizia in attesa',
    )
  })
})
