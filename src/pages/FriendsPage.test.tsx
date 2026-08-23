import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FriendsPage from './FriendsPage'
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
const mockedPost = vi.mocked(api.post)
const mockedPut = vi.mocked(api.put)

const emptyPage = { content: [], totalPages: 0, number: 0 }

function mockLists({
  friends = emptyPage,
  received = emptyPage,
  sent = emptyPage,
  requestsCount = 0,
}: {
  friends?: object
  received?: object
  sent?: object
  requestsCount?: number
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/user/getFriends') return Promise.resolve({ data: friends })
    if (url === '/user/getFriendshipReqReceived') return Promise.resolve({ data: received })
    if (url === '/user/getFriendshipReqSent') return Promise.resolve({ data: sent })
    if (url === '/user/friendshipRequests/count')
      return Promise.resolve({ data: { count: requestsCount } })
    return Promise.reject(new Error(`GET non mockata: ${url}`))
  })
}

function renderFriendsPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/friends']}>
        <Routes>
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/friends/:userId" element={<p>Dettaglio amico</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLists()
})

describe('FriendsPage', () => {
  it('mostra la lista degli amici', async () => {
    mockLists({
      friends: {
        content: [{ userId: 2, username: 'luigi', email: 'luigi@example.com' }],
        totalPages: 1,
        number: 0,
      },
    })
    renderFriendsPage()

    await screen.findByText('luigi')
    expect(screen.getByText('luigi@example.com')).toBeTruthy()
    expect(mockedGet).toHaveBeenCalledWith('/user/getFriends', {
      params: { page: 0, size: 20 },
    })
  })

  it('mostra lo stato vuoto senza amici', async () => {
    renderFriendsPage()
    await screen.findByText('Nessun amico ancora: invia la prima richiesta.')
  })

  it('filtra gli amici con il box di ricerca', async () => {
    mockLists({
      friends: {
        content: [
          { userId: 1, username: 'mario', email: 'mario@example.com' },
          { userId: 2, username: 'luigi', email: 'luigi@example.com' },
        ],
        totalPages: 1,
        number: 0,
      },
    })
    renderFriendsPage()

    await screen.findByText('mario')
    fireEvent.change(screen.getByLabelText('Cerca amici'), { target: { value: 'luigi' } })

    expect(screen.queryByText('mario')).toBeNull()
    expect(screen.getByText('luigi')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Cerca amici'), { target: { value: 'nessuno' } })
    await screen.findByText('Nessun amico corrisponde alla ricerca.')
  })

  it('cliccando sull’amico si apre il suo dettaglio', async () => {
    mockLists({
      friends: {
        content: [{ userId: 2, username: 'luigi', email: 'luigi@example.com' }],
        totalPages: 1,
        number: 0,
      },
    })
    renderFriendsPage()

    fireEvent.click(
      await screen.findByRole('button', { name: /luigi luigi@example\.com/ }),
    )
    await screen.findByText('Dettaglio amico')
  })

  it('mostra sul tab Ricevute il badge con il numero di richieste in attesa', async () => {
    mockLists({ requestsCount: 3 })
    renderFriendsPage()

    const tabRicevute = await screen.findByRole('button', { name: 'Ricevute 3' })
    expect(tabRicevute.textContent).toContain('3')
  })

  it('senza richieste in attesa il badge sul tab Ricevute non compare', async () => {
    renderFriendsPage()

    const tabRicevute = await screen.findByRole('button', { name: 'Ricevute' })
    expect(tabRicevute.textContent).toBe('Ricevute')
  })

  it('accetta una richiesta ricevuta passando lo userId del richiedente', async () => {
    mockLists({
      received: {
        content: [
          {
            friendshipId: 10,
            applicant: { userId: 7, username: 'anna' },
            stato: 'IN_ATTESA',
            dataRichiesta: '2026-08-10T10:00:00',
            messaggio: 'Ciao!',
          },
        ],
        totalPages: 1,
        number: 0,
      },
    })
    mockedPut.mockResolvedValue({ data: {} })
    renderFriendsPage()

    fireEvent.click(screen.getByRole('button', { name: 'Ricevute' }))
    await screen.findByText('anna')
    fireEvent.click(screen.getByRole('button', { name: 'Accetta' }))

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/user/acceptFriendship', null, {
        params: { friendId: 7 },
      }),
    )
  })

  it('annulla una richiesta inviata con refuseFriendship', async () => {
    mockLists({
      sent: {
        content: [
          {
            friendshipId: 11,
            recipient: { userId: 9, username: 'paolo' },
            stato: 'IN_ATTESA',
            dataRichiesta: '2026-08-10T10:00:00',
          },
        ],
        totalPages: 1,
        number: 0,
      },
    })
    mockedPut.mockResolvedValue({ data: {} })
    renderFriendsPage()

    fireEvent.click(screen.getByRole('button', { name: 'Inviate' }))
    await screen.findByText('paolo')
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/user/refuseFriendship', null, {
        params: { friendId: 9 },
      }),
    )
  })

  it('invia una nuova richiesta con name e message come query params', async () => {
    mockedPost.mockResolvedValue({ data: '' })
    renderFriendsPage()

    fireEvent.click(screen.getByRole('button', { name: 'Nuova richiesta' }))
    fireEvent.change(await screen.findByLabelText('Username o email'), {
      target: { value: 'anna@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Messaggio'), { target: { value: 'Ciao!' } })
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/user/sendFriendshipRequest', null, {
        params: { name: 'anna@example.com', message: 'Ciao!' },
      }),
    )
  })
})
