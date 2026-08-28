import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReleasesCard from './ReleasesCard'

const mockedFetch = vi.fn()

function jsonResponse(data: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => data }
}

const backendCommits = [
  {
    sha: 'abc1234567890def',
    html_url: 'https://github.com/Marcozzi96/SplitBill_javaWS/commit/abc1234567890def',
    commit: {
      message: 'Endpoint /api/status\n\nDettagli implementazione',
      author: { name: 'Marco', date: '2026-08-27T10:30:00Z' },
    },
    author: { login: 'Marcozzi96' },
  },
]

const frontendCommits = [
  {
    sha: 'fedcba0987654321',
    html_url: 'https://github.com/Marcozzi96/SplitBill/commit/fedcba0987654321',
    commit: {
      message: 'Pagina stato server',
      author: { name: 'Marco Rossi', date: '2026-08-28T07:00:00Z' },
    },
    author: null,
  },
]

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ReleasesCard />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockedFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ReleasesCard', () => {
  it('mostra i commit delle sezioni Backend e Frontend', async () => {
    mockedFetch
      .mockResolvedValueOnce(jsonResponse(backendCommits))
      .mockResolvedValueOnce(jsonResponse(frontendCommits))
    renderCard()

    expect(screen.getByText('Backend')).toBeTruthy()
    expect(screen.getByText('Frontend')).toBeTruthy()
    // Prima riga del messaggio multilinea, sha corto come link, autore da login.
    expect(await screen.findByText('Endpoint /api/status')).toBeTruthy()
    expect(screen.queryByText('Dettagli implementazione')).toBeNull()
    const shaLink = await screen.findByRole('link', { name: 'abc1234' })
    expect(shaLink).toHaveProperty('href', backendCommits[0].html_url)
    expect(shaLink).toHaveProperty('target', '_blank')
    expect(screen.getByText(/Marcozzi96/)).toBeTruthy()
    // author null: fallback sul nome dell'autore del commit.
    expect(await screen.findByText(/Marco Rossi/)).toBeTruthy()

    expect(mockedFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/Marcozzi96/SplitBill_javaWS/commits?sha=main&per_page=5',
    )
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/Marcozzi96/SplitBill/commits?sha=main&per_page=5',
    )
  })

  it('mostra un messaggio inline se la chiamata GitHub fallisce (es. rate limit)', async () => {
    mockedFetch.mockResolvedValue(jsonResponse({ message: 'API rate limit exceeded' }, false, 403))
    renderCard()

    // findAllByText si ferma al primo match: con waitFor attendo entrambe le sezioni.
    await waitFor(() => {
      expect(screen.getAllByText(/Commit non disponibili/).length).toBe(2)
    })
  })

  it('il fallimento di un repo non blocca la sezione dell’altro', async () => {
    mockedFetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(jsonResponse(frontendCommits))
    renderCard()

    expect(await screen.findByText('Pagina stato server')).toBeTruthy()
    expect((await screen.findAllByText(/Commit non disponibili/)).length).toBe(1)
  })
})
