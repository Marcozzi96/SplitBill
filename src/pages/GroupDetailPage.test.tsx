import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GroupDetailPage from './GroupDetailPage'
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

const mockedGet = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)
const mockedPut = vi.mocked(api.put)
const mockedDelete = vi.mocked(api.delete)

const group = { groupId: 5, name: 'Vacanze', description: 'Viaggio estivo', creationDate: '2026-08-01' }

const members = [
  { userId: 1, username: 'mario', email: 'mario@example.com', role: 'ADMIN', dataIngresso: '2026-08-01' },
  { userId: 2, username: 'luigi', email: 'luigi@example.com', role: 'MEMBER', dataIngresso: '2026-08-02' },
]

function mockApi({
  membersData = members,
  friends = { content: [], totalPages: 0, number: 0 },
  settlements = [],
}: {
  membersData?: object[]
  friends?: object
  settlements?: object[]
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/groups/5') return Promise.resolve({ data: group })
    if (url === '/groups/5/members') return Promise.resolve({ data: membersData })
    if (url === '/groups/5/settlement-status') return Promise.resolve({ data: settlements })
    if (url === '/user/getFriends') return Promise.resolve({ data: friends })
    return Promise.reject(new Error(`GET non mockata: ${url}`))
  })
}

function renderDetail(currentUserId = 1) {
  const queryClient = new QueryClient()
  const authValue = {
    user: { userId: currentUserId, username: 'mario', email: 'mario@example.com' },
    token: 'token',
    isLoading: false,
    isError: false,
    retryFetchUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  } satisfies AuthContextValue
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/groups/5']}>
          <Routes>
            <Route path="/groups/:groupId" element={<GroupDetailPage />} />
            <Route path="/groups" element={<p>Lista gruppi</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi()
})

describe('GroupDetailPage', () => {
  it('mostra info gruppo e membri con ruolo', async () => {
    renderDetail()

    await screen.findByRole('heading', { name: 'Vacanze' })
    expect(screen.getByText('Viaggio estivo')).toBeTruthy()
    expect(screen.getByText('luigi')).toBeTruthy()
    expect(screen.getByText('Admin')).toBeTruthy()
    expect(screen.getByText('Membro')).toBeTruthy()
  })

  it('nasconde le azioni admin a un semplice membro', async () => {
    renderDetail(2)

    await screen.findByRole('heading', { name: 'Vacanze' })
    expect(screen.queryByRole('button', { name: 'Elimina gruppo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Modifica gruppo' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Esci dal gruppo' })).toBeTruthy()
  })

  it('modifica nome e descrizione come query params', async () => {
    mockedPut.mockResolvedValue({ data: group })
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifica gruppo' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Vacanze 2026' } })
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/groups/5', null, {
        params: { name: 'Vacanze 2026', description: 'Viaggio estivo' },
      }),
    )
  })

  it('aggiunge membri con gli userId nel body', async () => {
    mockApi({
      friends: {
        content: [{ userId: 9, username: 'anna', email: 'anna@example.com' }],
        totalPages: 1,
        number: 0,
      },
    })
    mockedPost.mockResolvedValue({ data: group })
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Aggiungi' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/groups/addUsers/5', [9]))
  })

  it('al 409 mostra i debiti pendenti e riprova con force=true', async () => {
    mockApi({
      settlements: [
        {
          debtor: { userId: 2, username: 'luigi' },
          creditor: { userId: 1, username: 'mario' },
          amount: 42.5,
        },
      ],
    })
    mockedDelete
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: {} } })
      .mockResolvedValueOnce({ data: {} })
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Elimina gruppo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina' }))

    // Dopo il 409 vengono caricati e mostrati i debiti pendenti.
    await screen.findByText('Elimina comunque')
    expect(screen.getByText(/42,50/)).toBeTruthy()
    expect(mockedGet).toHaveBeenCalledWith('/groups/5/settlement-status')
    expect(mockedDelete).toHaveBeenCalledWith('/groups/5', { params: { force: false } })

    fireEvent.click(screen.getByRole('button', { name: 'Elimina comunque' }))
    await waitFor(() =>
      expect(mockedDelete).toHaveBeenCalledWith('/groups/5', { params: { force: true } }),
    )
    await screen.findByText('Lista gruppi')
  })

  it('esce dal gruppo e torna alla lista', async () => {
    mockedDelete.mockResolvedValue({ data: {} })
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Esci dal gruppo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Esci' }))

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('/groups/leave/5'))
    await screen.findByText('Lista gruppi')
  })
})
