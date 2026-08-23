import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './AppLayout'
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

function mockApi() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/user/friendshipRequests/count') return Promise.resolve({ data: { count: 0 } })
    if (url === '/groups')
      return Promise.resolve({
        data: { content: [{ groupId: 5, name: 'Vacanze' }], totalPages: 1, number: 0 },
      })
    if (url === '/user/getFriends')
      return Promise.resolve({
        data: {
          content: [{ userId: 2, username: 'luigi', email: 'luigi@example.com' }],
          totalPages: 1,
          number: 0,
        },
      })
    if (url === '/groups/5/members')
      return Promise.resolve({
        data: [
          { userId: 1, username: 'mario' },
          { userId: 2, username: 'luigi' },
        ],
      })
    return Promise.reject(new Error(`GET non mockata: ${url}`))
  })
}

function renderAt(path: string) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="*" element={<div>Contenuto pagina</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi()
})

// Il FAB cambia azione in base alla pagina corrente.
describe('AppLayout — FAB contestuale', () => {
  it.each(['/', '/settings'])('su %s apre la nuova spesa con scelta del contesto', async (path) => {
    renderAt(path)

    fireEvent.click(screen.getByRole('button', { name: 'Nuova spesa' }))

    expect(await screen.findByLabelText('Contesto')).toBeTruthy()
  })

  it('su /friends apre la nuova richiesta di amicizia', async () => {
    renderAt('/friends')

    fireEvent.click(screen.getByRole('button', { name: 'Nuova richiesta di amicizia' }))

    expect(await screen.findByText('Inserisci username o email della persona da aggiungere.')).toBeTruthy()
  })

  it('su /groups apre la creazione di un nuovo gruppo', async () => {
    renderAt('/groups')

    fireEvent.click(screen.getByRole('button', { name: 'Nuovo gruppo' }))

    expect(await screen.findByText('Dai un nome al gruppo e aggiungi gli amici che ne faranno parte.')).toBeTruthy()
  })

  it('sul dettaglio amico apre la nuova spesa personale con l\u2019amico preselezionato', async () => {
    renderAt('/friends/2')

    fireEvent.click(screen.getByRole('button', { name: 'Nuova spesa' }))

    expect(await screen.findByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Contesto')).toHaveProperty('value', 'personale')
  })

  it('sul dettaglio gruppo apre la nuova spesa con il gruppo preselezionato', async () => {
    renderAt('/groups/5')

    fireEvent.click(screen.getByRole('button', { name: 'Nuova spesa' }))

    // Membri del gruppo caricati e tutti selezionati di default.
    expect(await screen.findByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    await screen.findByRole('option', { name: 'Gruppo: Vacanze' })
    expect(screen.getByLabelText('Contesto')).toHaveProperty('value', '5')
  })
})
