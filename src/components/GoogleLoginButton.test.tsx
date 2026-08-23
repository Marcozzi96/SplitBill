import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthProvider from '@/auth/AuthProvider'
import GoogleLoginButton from './GoogleLoginButton'
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

const initialize = vi.fn()
const renderButton = vi.fn()

function renderGoogleButton() {
  const queryClient = new QueryClient()
  const onError = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<GoogleLoginButton onError={onError} />} />
            <Route path="/" element={<div>Home</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
  return onError
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id')
  // Script GSI già "caricato": loadGoogleScript risolve senza toccare il DOM.
  window.google = { accounts: { id: { initialize, renderButton } } }
})

afterEach(() => {
  vi.unstubAllEnvs()
  delete window.google
})

describe('GoogleLoginButton', () => {
  it('non renderizza nulla senza VITE_GOOGLE_CLIENT_ID', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <MemoryRouter>
            <GoogleLoginButton onError={vi.fn()} />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    )
    expect(container.firstChild).toBeNull()
    expect(initialize).not.toHaveBeenCalled()
  })

  it('inizializza il client Google e renderizza il bottone nel container', async () => {
    renderGoogleButton()
    await waitFor(() =>
      expect(initialize).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 'test-client-id' }),
      ),
    )
    expect(renderButton).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({ text: 'continue_with', shape: 'rectangular' }),
    )
  })

  it('alla callback con credential chiama /auth/google, fa login e naviga alla home', async () => {
    mockedPost.mockResolvedValue({
      data: { token: 'jwt-google', user: { userId: 1, username: 'mario' } },
    })
    renderGoogleButton()
    await waitFor(() => expect(initialize).toHaveBeenCalled())

    const callback = initialize.mock.calls[0][0].callback as (r: { credential?: string }) => void
    callback({ credential: 'google-id-token' })

    await screen.findByText('Home')
    expect(mockedPost).toHaveBeenCalledWith('/auth/google', { idToken: 'google-id-token' })
    expect(localStorage.getItem('splitbill_token')).toBe('jwt-google')
  })

  it('propaga a onError il messaggio del backend su errore API', async () => {
    mockedPost.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { message: 'Token Google non valido' } },
    })
    const onError = renderGoogleButton()
    await waitFor(() => expect(initialize).toHaveBeenCalled())

    const callback = initialize.mock.calls[0][0].callback as (r: { credential?: string }) => void
    callback({ credential: 'google-id-token' })

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Token Google non valido'))
    expect(localStorage.getItem('splitbill_token')).toBeNull()
  })
})
