import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import SettingsPage from './SettingsPage'
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

const mockedPut = vi.mocked(api.put)
const mockedGet = vi.mocked(api.get)
const mockedDelete = vi.mocked(api.delete)

const authValue: AuthContextValue = {
  user: { userId: 1, username: 'mario', email: 'mario@example.com' },
  token: 'token',
  isLoading: false,
  isError: false,
  retryFetchUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <MemoryRouter initialEntries={['/settings']}>
            <SettingsPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  // useMySettlements (DeleteAccountCard): default nessun debito aperto.
  mockedGet.mockResolvedValue({ data: [] })
})

// jsdom non implementa matchMedia, richiesto da next-themes.
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }))
})

describe('SettingsPage', () => {
  it('mostra username ed email dell\u2019utente', () => {
    renderPage()

    expect(screen.getAllByText('mario').length).toBeGreaterThan(0)
    expect(screen.getByText('mario@example.com')).toBeTruthy()
  })

  it('il selettore tema applica la classe dark e persiste la scelta', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Scuro/ }))

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
    expect(localStorage.getItem('theme')).toBe('dark')

    fireEvent.click(screen.getByRole('button', { name: /Chiaro/ }))

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('il cambio username chiama /user/update e sostituisce il token', async () => {
    const auth = { token: 'nuovo-token', user: { userId: 1, username: 'luigi' } }
    mockedPut.mockResolvedValue({ data: auth })
    renderPage()

    fireEvent.change(screen.getByLabelText('Nuovo username'), { target: { value: 'luigi' } })
    fireEvent.change(screen.getByLabelText('Password attuale', { selector: '#username-old-password' }), {
      target: { value: 'Password123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salva username' }))

    await waitFor(() => {
      expect(mockedPut).toHaveBeenCalledWith('/user/update', {
        username: 'luigi',
        oldPassword: 'Password123!',
      })
    })
    expect(authValue.login).toHaveBeenCalledWith(auth)
  })

  it('il cambio password richiede che le nuove password coincidano', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Password attuale', { selector: '#old-password' }), {
      target: { value: 'Password123!' },
    })
    fireEvent.change(screen.getByLabelText('Nuova password'), { target: { value: 'Nuova123!' } })
    fireEvent.change(screen.getByLabelText('Conferma nuova password'), {
      target: { value: 'Diversa123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salva password' }))

    expect(await screen.findByText('Le nuove password non coincidono')).toBeTruthy()
    expect(mockedPut).not.toHaveBeenCalled()
  })

  it('il cambio password chiama /user/update con password e oldPassword', async () => {
    const auth = { token: 'nuovo-token', user: { userId: 1, username: 'mario' } }
    mockedPut.mockResolvedValue({ data: auth })
    renderPage()

    fireEvent.change(screen.getByLabelText('Password attuale', { selector: '#old-password' }), {
      target: { value: 'Password123!' },
    })
    fireEvent.change(screen.getByLabelText('Nuova password'), { target: { value: 'Nuova123!' } })
    fireEvent.change(screen.getByLabelText('Conferma nuova password'), {
      target: { value: 'Nuova123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salva password' }))

    await waitFor(() => {
      expect(mockedPut).toHaveBeenCalledWith('/user/update', {
        password: 'Nuova123!',
        oldPassword: 'Password123!',
      })
    })
    expect(authValue.login).toHaveBeenCalledWith(auth)
  })

  it('l’eliminazione account chiama /user/delete, poi logout', async () => {
    mockedDelete.mockResolvedValue({ data: undefined })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Elimina account' }))
    fireEvent.change(await screen.findByLabelText('Scrivi ELIMINA per confermare'), {
      target: { value: 'ELIMINA' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('/user/delete'))
    expect(authValue.logout).toHaveBeenCalled()
  })

  it('il bottone Elimina resta disabilitato senza la conferma testuale', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Elimina account' }))
    const confirm = await screen.findByRole('button', { name: 'Elimina' })
    expect(confirm).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByLabelText('Scrivi ELIMINA per confermare'), {
      target: { value: 'elimina' },
    })
    expect(screen.getByRole('button', { name: 'Elimina' })).toHaveProperty('disabled', false)
  })

  it('mostra un avviso se ci sono debiti o crediti aperti', async () => {
    mockedGet.mockResolvedValue({
      data: [
        { counterparty: { userId: 2, username: 'luigi' }, amount: 10, direction: 'DEBT' },
        { counterparty: { userId: 3, username: 'anna' }, amount: 5, direction: 'CREDIT' },
      ],
    })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Elimina account' }))

    expect(await screen.findByText(/2 debiti o crediti aperti/)).toBeTruthy()
  })

  it('l’errore API di eliminazione account è mostrato nel dialog', async () => {
    mockedDelete.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: 'Operazione non consentita' } },
    })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Elimina account' }))
    fireEvent.change(await screen.findByLabelText('Scrivi ELIMINA per confermare'), {
      target: { value: 'ELIMINA' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))

    expect(await screen.findByText('Operazione non consentita')).toBeTruthy()
    expect(authValue.logout).not.toHaveBeenCalled()
  })
})
