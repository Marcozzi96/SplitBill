import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PaymentsList from './PaymentsList'
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

const authValue: AuthContextValue = {
  user: { userId: 1, username: 'mario', email: 'mario@example.com' },
  token: 'token',
  isLoading: false,
  isError: false,
  retryFetchUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}

function renderList() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <PaymentsList />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PaymentsList', () => {
  it('mostra la cronologia paginata dal punto di vista dell’utente', async () => {
    mockedGet.mockResolvedValue({
      data: {
        content: [
          {
            paymentId: 1,
            payer: { userId: 1, username: 'mario' },
            payee: { userId: 2, username: 'luigi' },
            groupId: 5,
            amount: 10,
            date: '2026-08-15',
            notes: 'parziale',
          },
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
      },
    })
    renderList()

    // Il testo è spezzato in più span e formatEuro usa NBSP: confronto normalizzato.
    const textIs = (text: string) => (_: string, el: Element | null) =>
      el?.tagName === 'P' && el.textContent?.replace(/\s+/g, ' ').trim() === text
    expect(await screen.findByText(textIs('Hai rimborsato 10,00 € a luigi'))).toBeTruthy()
    const byText = (text: string) => screen.getByText(textIs(text))
    expect(byText('luigi ti ha rimborsato 5,00 €')).toBeTruthy()
    expect(byText('15 ago 2026 · di gruppo · parziale')).toBeTruthy()
    expect(byText('16 ago 2026 · personale')).toBeTruthy()
    expect(mockedGet).toHaveBeenCalledWith('/payments', { params: { page: 0, size: 20 } })
  })

  it('mostra lo stato vuoto senza rimborsi', async () => {
    mockedGet.mockResolvedValue({ data: { content: [], totalPages: 0, number: 0 } })
    renderList()

    await screen.findByText('Nessun rimborso ancora.')
  })
})
