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

function mockLists({ groups = emptyPage, friends = emptyPage }: { groups?: object; friends?: object } = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/groups') return Promise.resolve({ data: groups })
    if (url === '/user/getFriends') return Promise.resolve({ data: friends })
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
  it('mostra la lista dei gruppi con link al dettaglio', async () => {
    mockLists({
      groups: {
        content: [
          {
            groupId: 3,
            name: 'Vacanze',
            description: 'Viaggio estivo',
            creationDate: '2026-08-01',
          },
        ],
        totalPages: 1,
        number: 0,
      },
    })
    renderGroupsPage()

    await screen.findByText('Vacanze')
    expect(screen.getByText('Viaggio estivo')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Vacanze/ }).getAttribute('href')).toBe('/groups/3')
    expect(mockedGet).toHaveBeenCalledWith('/groups', { params: { page: 0, size: 20 } })
  })

  it('mostra lo stato vuoto senza gruppi', async () => {
    renderGroupsPage()
    await screen.findByText('Nessun gruppo ancora: crea il primo.')
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

    fireEvent.click(await screen.findByRole('button', { name: 'Nuovo gruppo' }))
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
