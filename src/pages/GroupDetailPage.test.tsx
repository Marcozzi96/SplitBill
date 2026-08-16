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
  bills = { content: [], totalPages: 0, number: 0 },
}: {
  membersData?: object[]
  friends?: object
  settlements?: object[]
  bills?: object
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/groups/5') return Promise.resolve({ data: group })
    if (url === '/groups/5/members') return Promise.resolve({ data: membersData })
    if (url === '/groups/5/settlement-status') return Promise.resolve({ data: settlements })
    if (url === '/user/getFriends') return Promise.resolve({ data: friends })
    if (url === '/bills/group/5') return Promise.resolve({ data: bills })
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
  it('mostra info gruppo e, nel modale, i membri con ruolo', async () => {
    renderDetail()

    await screen.findByRole('heading', { name: 'Vacanze' })
    expect(screen.getByText('Viaggio estivo')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Visualizza membri/ }))
    expect(await screen.findByText('luigi')).toBeTruthy()
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

    fireEvent.click(await screen.findByRole('button', { name: /Visualizza membri/ }))
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

  const bill = {
    billId: 9,
    description: 'Cena',
    amount: 50,
    notes: 'Pizzeria',
    creationDate: '2026-08-10',
    groupId: 5,
    buyer: { userId: 1, username: 'mario' },
    // Transazioni con segno, come dal backend: debitore -50, credito del buyer +50.
    transactions: [
      { transactionId: 1, userId: 2, amount: -50 },
      { transactionId: 2, userId: 1, amount: 50 },
    ],
  }

  it('mostra le spese del gruppo con buyer e importo', async () => {
    mockApi({ bills: { content: [bill], totalPages: 1, number: 0 } })
    renderDetail()

    await screen.findByText('Cena')
    expect(screen.getByText(/Pagata da mario/)).toBeTruthy()
    expect(screen.getByText(/50,00/)).toBeTruthy()
    expect(mockedGet).toHaveBeenCalledWith('/bills/group/5', {
      params: { page: 0, size: 20 },
    })
  })

  it('mostra modifica/eliminazione a qualsiasi membro del gruppo', async () => {
    mockApi({ bills: { content: [bill], totalPages: 1, number: 0 } })
    renderDetail(2) // luigi: semplice membro, non buyer — può comunque gestire la spesa

    await screen.findByText('Cena')
    expect(screen.getByRole('button', { name: 'Modifica Cena' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Elimina Cena' })).toBeTruthy()
  })

  it('elimina una spesa dopo conferma', async () => {
    mockApi({ bills: { content: [bill], totalPages: 1, number: 0 } })
    mockedDelete.mockResolvedValue({ data: {} })
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Elimina Cena' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina' }))

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('/bills/9'))
  })

  it('crea una spesa dal modale con tutti i membri selezionati di default', async () => {
    mockApi()
    mockedPost.mockResolvedValue({ data: { billId: 42 } })
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Nuova spesa' }))

    expect(await screen.findByLabelText('Partecipa mario')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Pagato da')).toHaveProperty('value', '1')

    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Cena' } })
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dividi equamente' }))
    fireEvent.submit(document.querySelector('[data-slot="dialog-content"] form')!)

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        '/bills/new',
        { 1: 50, 2: 50 },
        { params: { description: 'Cena', amount: 100, notes: '', groupId: 5, buyerId: 1 } },
      ),
    )
  })

  it('esclude i partecipanti deselezionati dalla nuova spesa', async () => {
    mockApi()
    mockedPost.mockResolvedValue({ data: { billId: 43 } })
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Nuova spesa' }))
    await screen.findByLabelText('Partecipa luigi')
    fireEvent.click(screen.getByLabelText('Partecipa luigi'))

    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Cena' } })
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dividi equamente' }))
    fireEvent.submit(document.querySelector('[data-slot="dialog-content"] form')!)

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        '/bills/new',
        { 1: 100 },
        { params: { description: 'Cena', amount: 100, notes: '', groupId: 5, buyerId: 1 } },
      ),
    )
  })

  it('modifica una spesa: dati in query params e ripartizione nel body', async () => {
    mockApi({ bills: { content: [bill], totalPages: 1, number: 0 } })
    mockedPut.mockResolvedValue({ data: bill })
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifica Cena' }))

    // Il form è precompilato dalla spesa: cambio solo la descrizione.
    const dialog = document.querySelector('[data-slot="dialog-content"]')!
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Cena sushi' } })
    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/bills/9', { 2: 50 }, {
        params: { description: 'Cena sushi', amount: 50, notes: 'Pizzeria', buyerId: 1 },
      }),
    )
  })

  it('blocca la modifica se la somma delle quote non pareggia l’importo', async () => {
    mockApi({ bills: { content: [bill], totalPages: 1, number: 0 } })
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Modifica Cena' }))
    fireEvent.change(screen.getByLabelText('Quota luigi'), { target: { value: '40' } })
    fireEvent.submit(document.querySelector('[data-slot="dialog-content"] form')!)

    await screen.findByText(/non pareggia l'importo/)
    expect(mockedPut).not.toHaveBeenCalled()
  })
})
