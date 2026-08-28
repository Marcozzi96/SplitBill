import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import StatusPage from './StatusPage'
import { api } from '@/api/client'

vi.mock('@/api/client', () => ({
  TOKEN_KEY: 'splitbill_token',
  api: {
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

const mockedGet = vi.mocked(api.get)

const statusPayload = {
  timestamp: '2026-08-28T07:00:00Z',
  hostname: 'vps-test',
  uptimeSeconds: 123456, // 1g 10h 17m
  cpu: { cores: 2, usagePercent: 12.5 },
  memory: {
    totalBytes: 4 * 1024 ** 3,
    usedBytes: 2 * 1024 ** 3,
    freeBytes: 2 * 1024 ** 3,
    usagePercent: 50,
  },
  disk: {
    totalBytes: 80 * 1024 ** 3,
    usedBytes: 20 * 1024 ** 3,
    freeBytes: 60 * 1024 ** 3,
    usagePercent: 25,
  },
  network: { rxBytesTotal: 1024 ** 3, txBytesTotal: 512 * 1024 ** 2 },
  http: {
    requestsTotal: 1000,
    bytesInTotal: 2048,
    bytesOutTotal: 4096,
    requests2xx: 900,
    requests4xx: 80,
    requests5xx: 20,
    totalTimeMs: 5000,
  },
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/status']}>
        <StatusPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StatusPage', () => {
  it('mostra hostname, uptime e tutte le card con i dati del server', async () => {
    mockedGet.mockResolvedValue({ data: statusPayload })
    renderPage()

    expect(await screen.findByText('vps-test')).toBeTruthy()
    expect(screen.getByText('1g 10h 17m')).toBeTruthy()
    expect(screen.getByText('CPU')).toBeTruthy()
    expect(screen.getByText('RAM')).toBeTruthy()
    expect(screen.getByText('Disco')).toBeTruthy()
    expect(screen.getByText('Rete')).toBeTruthy()
    expect(screen.getByText('Traffico HTTP')).toBeTruthy()
    expect(screen.getByText('12,5%')).toBeTruthy()
    expect(screen.getByText('2 core')).toBeTruthy()
    expect(mockedGet).toHaveBeenCalledWith('/api/status')
  })

  it('al primo poll i rate non sono disponibili', async () => {
    mockedGet.mockResolvedValue({ data: statusPayload })
    renderPage()

    await screen.findByText('vps-test')

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('mostra lo stato di errore con il messaggio del backend e il bottone Riprova', async () => {
    mockedGet.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Server non raggiungibile' } },
    })
    renderPage()

    expect(await screen.findByText('Server non raggiungibile')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy()
  })
})
