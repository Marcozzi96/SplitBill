import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import PaymentsPage from './PaymentsPage'
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

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/payments']}>
          <PaymentsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGet.mockImplementation((url: string) => {
    if (url === '/payments') return Promise.resolve({ data: payments })
    return Promise.reject(new Error(`GET non mockata: ${url}`))
  })
})

describe('PaymentsPage', () => {
  it('mostra la cronologia dal punto di vista dell’utente', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Rimborsi' })
    expect(byText('Hai rimborsato 10,00 € a luigi')).toBeTruthy()
    expect(byText('luigi ti ha rimborsato 5,00 €')).toBeTruthy()
    expect(byText('15 ago 2026 · di gruppo · parziale')).toBeTruthy()
    expect(byText('16 ago 2026 · personale')).toBeTruthy()
    expect(mockedGet).toHaveBeenCalledWith('/payments', { params: { page: 0, size: 20 } })
  })

  it('mostra lo stato vuoto senza rimborsi', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/payments')
        return Promise.resolve({ data: { content: [], totalPages: 0, number: 0 } })
      return Promise.reject(new Error(`GET non mockata: ${url}`))
    })
    renderPage()

    await screen.findByText('Nessun rimborso ancora.')
  })
})
