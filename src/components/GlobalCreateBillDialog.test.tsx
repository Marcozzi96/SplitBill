import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GlobalCreateBillDialog from './GlobalCreateBillDialog'
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

const authValue: AuthContextValue = {
  user: { userId: 1, username: 'mario', email: 'mario@example.com' },
  token: 'token',
  isLoading: false,
  isError: false,
  retryFetchUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}

function mockApi() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/groups')
      return Promise.resolve({
        data: { content: [{ groupId: 5, name: 'Vacanze' }], totalPages: 1, number: 0 },
      })
    if (url === '/user/getFriends')
      return Promise.resolve({
        data: {
          content: [{ userId: 2, username: 'luigi', email: 'luigi@example.com' }],
          totalPages: 1,
          number: 0,
        },
      })
    if (url === '/groups/5/members')
      return Promise.resolve({
        data: [
          { userId: 1, username: 'mario' },
          { userId: 2, username: 'luigi' },
        ],
      })
    if (url === '/shopping-items/group/5')
      return Promise.resolve({ data: { content: [], totalPages: 0, number: 0 } })
    return Promise.reject(new Error(`GET non mockata: ${url}`))
  })
}

function renderDialog(props?: { defaultContext?: string; defaultFriendIds?: number[] }) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <GlobalCreateBillDialog open onOpenChange={() => {}} {...props} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi()
})

describe('GlobalCreateBillDialog', () => {
  it('in contesto personale richiede almeno un amico prima di mostrare il form', async () => {
    renderDialog()

    expect(
      await screen.findByText('Seleziona almeno un amico per continuare.'),
    ).toBeTruthy()
    expect(screen.queryByLabelText('Descrizione')).toBeNull()

    fireEvent.click(await screen.findByRole('checkbox', { name: /luigi/ }))

    // Il form appare con me e l'amico come partecipanti preselezionati.
    expect(await screen.findByLabelText('Partecipa mario')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Pagato da')).toHaveProperty('value', '1')
  })

  it('crea una spesa personale senza groupId', async () => {
    mockedPost.mockResolvedValue({ data: { billId: 50 } })
    renderDialog()

    fireEvent.click(await screen.findByRole('checkbox', { name: /luigi/ }))
    await screen.findByLabelText('Descrizione')
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Pizza' } })
    fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dividi equamente' }))
    fireEvent.submit(document.querySelector('[data-slot="dialog-content"] form')!)

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        '/bills/new',
        { 1: 10, 2: 10 },
        { params: { description: 'Pizza', amount: 20, notes: '', buyerId: 1 } },
      ),
    )
  })

  it('in contesto gruppo carica i membri e crea la spesa con groupId', async () => {
    mockedPost.mockResolvedValue({ data: { billId: 51 } })
    renderDialog()

    // Attende che i gruppi siano caricati: senza l'option nel DOM la change è ignorata.
    await screen.findByRole('option', { name: 'Gruppo: Vacanze' })
    fireEvent.change(screen.getByLabelText('Contesto'), { target: { value: '5' } })

    // Membri del gruppo caricati dal backend.
    expect(await screen.findByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(mockedGet).toHaveBeenCalledWith('/groups/5/members')

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

  // FAB contestuale dal dettaglio amico: personale con l'amico già selezionato.
  it('con defaultFriendIds preseleziona gli amici e mostra subito il form', async () => {
    renderDialog({ defaultFriendIds: [2] })

    expect(await screen.findByLabelText('Descrizione')).toBeTruthy()
    expect(screen.getByLabelText('Partecipa mario')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(screen.queryByText('Seleziona almeno un amico per continuare.')).toBeNull()
  })

  // FAB contestuale dal dettaglio gruppo: contesto gruppo già impostato.
  it('con defaultContext preseleziona il gruppo e carica i suoi membri', async () => {
    renderDialog({ defaultContext: '5' })

    expect(await screen.findByLabelText('Partecipa luigi')).toHaveProperty('checked', true)
    expect(mockedGet).toHaveBeenCalledWith('/groups/5/members')
    await screen.findByRole('option', { name: 'Gruppo: Vacanze' })
    expect(screen.getByLabelText('Contesto')).toHaveProperty('value', '5')
  })
})
