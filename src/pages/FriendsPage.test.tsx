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
  settlements = [] as object[],
  requestsCount = 0,
}: {
  friends?: object
  received?: object
  sent?: object
  settlements?: object[]
  requestsCount?: number
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/user/getFriends') return Promise.resolve({ data: friends })
    if (url === '/user/getFriendshipReqReceived') return Promise.resolve({ data: received })
    if (url === '/user/getFriendshipReqSent') return Promise.resolve({ data: sent })
    if (url === '/balance/settlements') return Promise.resolve({ data: settlements })
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
  it('mostra la lista degli amici con il saldo personale', async () => {
    mockLists({
      friends: {
        content: [
          { userId: 1, username: 'anna', email: 'anna@example.com' },
          { userId: 2, username: 'bruno', email: 'bruno@example.com' },
        ],
        totalPages: 1,
        number: 0,
      },
      settlements: [
        // Bruno mi deve 12,50 (personale, senza gruppo).
        {
          counterparty: { userId: 2, username: 'bruno' },
          amount: 12.5,
          direction: 'CREDIT',
          groupId: null,
        },
        // Debito di gruppo con anna: non deve pesare sul saldo personale.
        {
          counterparty: { userId: 1, username: 'anna' },
          amount: 30,
          direction: 'DEBT',
          groupId: 5,
          groupName: 'Calcetto',
        },
      ],
    })
    renderFriendsPage()

    await screen.findByText('ti deve 12,50 €')
    // anna ha solo un debito di gruppo: qui risulta in pari.
    expect(screen.getByText('in pari')).toBeTruthy()
    expect(mockedGet).toHaveBeenCalledWith('/user/getFriends', {
      params: { page: 0, size: 20 },
    })
  })

  it('ordina gli amici per saldo aperto prima dell’ordine alfabetico', async () => {
    mockLists({
      friends: {
        content: [
          { userId: 1, username: 'anna', email: 'anna@example.com' },
          { userId: 2, username: 'bruno', email: 'bruno@example.com' },
        ],
        totalPages: 1,
        number: 0,
      },
      settlements: [
        {
          counterparty: { userId: 2, username: 'bruno' },
          amount: 5,
          direction: 'DEBT',
          groupId: null,
        },
      ],
    })
    renderFriendsPage()

    await screen.findByText('devi 5,00 €')
    const links = screen.getAllByRole('link')
    // bruno (saldo aperto) prima di anna (in pari), nonostante l'alfabeto.
    expect(links[0].textContent).toContain('bruno')
    expect(links[1].textContent).toContain('anna')
  })

  it('mostra lo stato vuoto con invito a inviare la prima richiesta', async () => {
    renderFriendsPage()
    await screen.findByText('Nessun amico ancora.')
    expect(screen.getByRole('button', { name: /Invia la prima richiesta/ })).toBeTruthy()
  })

  it('le righe degli amici sono link al dettaglio', async () => {
    mockLists({
      friends: {
        content: [{ userId: 2, username: 'luigi', email: 'luigi@example.com' }],
        totalPages: 1,
        number: 0,
      },
    })
    renderFriendsPage()

    const row = await screen.findByRole('link', { name: /luigi/ })
    expect(row.getAttribute('href')).toBe('/friends/2')
  })

  it('mostra sul tab Richieste il badge con il numero di richieste in attesa', async () => {
    mockLists({ requestsCount: 3 })
    renderFriendsPage()

    const tab = await screen.findByRole('tab', { name: 'Richieste 3' })
    expect(tab.textContent).toContain('3')
  })

  it('senza richieste in attesa il badge sul tab Richieste non compare', async () => {
    renderFriendsPage()

    const tab = await screen.findByRole('tab', { name: 'Richieste' })
    expect(tab.textContent).toBe('Richieste')
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

    fireEvent.click(screen.getByRole('tab', { name: 'Richieste' }))
    await screen.findByText('anna')
    fireEvent.click(screen.getByRole('button', { name: 'Accetta' }))

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/user/acceptFriendship', null, {
        params: { friendId: 7 },
      }),
    )
  })

  it('annulla una richiesta inviata con refuseFriendship dalla sezione Inviate', async () => {
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

    fireEvent.click(screen.getByRole('tab', { name: 'Richieste' }))
    await screen.findByText('paolo')
    expect(screen.getByText('Inviate')).toBeTruthy()
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

    fireEvent.click(await screen.findByRole('button', { name: /Invia la prima richiesta/ }))
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
