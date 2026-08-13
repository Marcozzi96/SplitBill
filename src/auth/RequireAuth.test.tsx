import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthProvider from '@/auth/AuthProvider'
import RequireAuth from '@/auth/RequireAuth'
import { api } from '@/api/client'

vi.mock('@/api/client', () => ({
  TOKEN_KEY: 'splitbill_token',
  api: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

const mockedGet = vi.mocked(api.get)

function renderProtected() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/protected" element={<div>Area riservata</div>} />
            </Route>
            <Route path="/login" element={<div>Pagina di login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('RequireAuth', () => {
  it('senza token reindirizza a /login', () => {
    renderProtected()
    expect(screen.getByText('Pagina di login')).toBeTruthy()
    expect(screen.queryByText('Area riservata')).toBeNull()
  })

  it('con token valido mostra la pagina protetta', async () => {
    localStorage.setItem('splitbill_token', 'jwt-123')
    mockedGet.mockResolvedValue({ data: { userId: 1, username: 'mario' } })
    renderProtected()

    await screen.findByText('Area riservata')
    expect(mockedGet).toHaveBeenCalledWith('/user/me')
  })

  it('se /user/me fallisce mostra errore e bottone riprova', async () => {
    localStorage.setItem('splitbill_token', 'jwt-123')
    mockedGet.mockRejectedValue({ isAxiosError: true, message: 'Network Error' })
    renderProtected()

    await screen.findByText(/Impossibile caricare i dati utente/)
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy()
    expect(screen.queryByText('Area riservata')).toBeNull()
  })
})
