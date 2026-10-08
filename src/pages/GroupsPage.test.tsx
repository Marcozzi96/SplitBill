import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import GroupsPage from './GroupsPage'
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

const emptyPage = { content: [], totalPages: 0, number: 0 }

function mockLists({
  groups = emptyPage,
  friends = emptyPage,
  settlements = [] as object[],
}: {
  groups?: object
  friends?: object
  settlements?: object[]
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/groups') return Promise.resolve({ data: groups })
    if (url === '/user/getFriends') return Promise.resolve({ data: friends })
    if (url === '/balance/settlements') return Promise.resolve({ data: settlements })
    return Promise.reject(new Error(`GET non mockata: ${url}`))
  })
}

function renderGroupsPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GroupsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLists()
})

describe('GroupsPage', () => {
  it('mostra la lista dei gruppi con link al dettaglio e saldo', async () => {
    mockLists({
      groups: {
        content: [
          {
            groupId: 3,
            name: 'Vacanze',
            description: 'Viaggio estivo',
            creationDate: '2026-08-01',
            users: [{ userId: 1 }, { userId: 2 }, { userId: 3 }, { userId: 4 }],
          },
        ],
        totalPages: 1,
        number: 0,
      },
      settlements: [
        {
          counterparty: { userId: 2, username: 'anna' },
          amount: 8,
          direction: 'DEBT',
          groupId: 3,
          groupName: 'Vacanze',
        },
      ],
    })
    renderGroupsPage()

    await screen.findByText('Vacanze')
    expect(screen.getByText('4 membri · Viaggio estivo')).toBeTruthy()
    expect(screen.getByText('−8,00 €')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Vacanze/ }).getAttribute('href')).toBe('/groups/3')
    expect(mockedGet).toHaveBeenCalledWith('/groups', { params: { page: 0, size: 20 } })
  })

  it('senza saldi aperti il gruppo risulta in pari', async () => {
    mockLists({
      groups: {
        content: [{ groupId: 3, name: 'Vacanze', creationDate: '2026-08-01' }],
        totalPages: 1,
        number: 0,
      },
    })
    renderGroupsPage()

    await screen.findByText('Vacanze')
    expect(screen.getByText('in pari')).toBeTruthy()
  })

  it('mostra lo stato vuoto con invito a creare il primo gruppo', async () => {
    renderGroupsPage()
    await screen.findByText('Nessun gruppo ancora.')
    expect(screen.getByRole('button', { name: /Crea il primo gruppo/ })).toBeTruthy()
  })

  it('crea un gruppo con nome/descrizione in query params e membri nel body', async () => {
    mockLists({
      friends: {
        content: [{ userId: 7, username: 'anna', email: 'anna@example.com' }],
        totalPages: 1,
        number: 0,
      },
    })
    mockedPost.mockResolvedValue({ data: { groupId: 10 } })
    renderGroupsPage()

    fireEvent.click(await screen.findByRole('button', { name: /Crea il primo gruppo/ }))
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Casa' } })
    fireEvent.change(screen.getByLabelText('Descrizione'), {
      target: { value: 'Spese condominiali' },
    })
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/groups/create', [7], {
        params: { name: 'Casa', description: 'Spese condominiali' },
      }),
    )
  })
})
