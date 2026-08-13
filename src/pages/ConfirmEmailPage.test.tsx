import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ConfirmEmailPage from './ConfirmEmailPage'
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

function renderConfirmEmailPage(entry: string) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/auth/confirmEmail" element={<ConfirmEmailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConfirmEmailPage', () => {
  it('senza token mostra link non valido e non chiama la API', () => {
    renderConfirmEmailPage('/auth/confirmEmail')
    expect(screen.getByText('Link non valido')).toBeTruthy()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('con token valido conferma la registrazione', async () => {
    mockedGet.mockResolvedValue({ data: { userId: 1, username: 'mario' } })
    renderConfirmEmailPage('/auth/confirmEmail?token=abc123')

    await screen.findByText('Email confermata')
    expect(mockedGet).toHaveBeenCalledWith('/auth/confirmEmail', {
      params: { token: 'abc123' },
    })
  })

  it('con token scaduto mostra il messaggio del backend', async () => {
    mockedGet.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: 'Token scaduto' } },
    })
    renderConfirmEmailPage('/auth/confirmEmail?token=scaduto')

    await screen.findByText('Conferma non riuscita')
    await screen.findByText('Token scaduto')
  })
})
