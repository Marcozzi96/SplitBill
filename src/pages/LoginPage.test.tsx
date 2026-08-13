import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthProvider from '@/auth/AuthProvider'
import LoginPage from './LoginPage'
import { api } from '@/api/client'

vi.mock('@/api/client', () => ({
  TOKEN_KEY: 'splitbill_token',
  api: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

const mockedPost = vi.mocked(api.post)

function renderLoginPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>Home</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

function fillAndSubmit(identifier: string, password: string) {
  fireEvent.change(screen.getByLabelText('Username o email'), { target: { value: identifier } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.submit(document.querySelector('form')!)
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('mostra il form di accesso', () => {
    renderLoginPage()
    expect(screen.getByLabelText('Username o email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeTruthy()
  })

  it('fa login con username e naviga alla home', async () => {
    mockedPost.mockResolvedValue({
      data: { token: 'jwt-123', user: { userId: 1, username: 'mario' } },
    })
    renderLoginPage()
    fillAndSubmit('mario', 'Password123!')

    await screen.findByText('Home')
    expect(mockedPost).toHaveBeenCalledWith('/auth/login', {
      username: 'mario',
      password: 'Password123!',
    })
    expect(localStorage.getItem('splitbill_token')).toBe('jwt-123')
  })

  it('fa login con email', async () => {
    mockedPost.mockResolvedValue({
      data: { token: 'jwt-123', user: { userId: 1, username: 'mario' } },
    })
    renderLoginPage()
    fillAndSubmit('mario@example.com', 'Password123!')

    await waitFor(() => expect(mockedPost).toHaveBeenCalled())
    expect(mockedPost).toHaveBeenCalledWith('/auth/login', {
      email: 'mario@example.com',
      password: 'Password123!',
    })
  })

  it('mostra il messaggio del backend su credenziali non valide', async () => {
    mockedPost.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { message: 'Credenziali non valide' } },
    })
    renderLoginPage()
    fillAndSubmit('mario', 'sbagliata')

    await screen.findByText('Credenziali non valide')
    expect(localStorage.getItem('splitbill_token')).toBeNull()
  })

  it('mostra un messaggio dedicato sul 429', async () => {
    mockedPost.mockRejectedValue({ isAxiosError: true, response: { status: 429 } })
    renderLoginPage()
    fillAndSubmit('mario', 'Password123!')

    await screen.findByText('Troppe richieste, riprovare tra poco')
  })
})
