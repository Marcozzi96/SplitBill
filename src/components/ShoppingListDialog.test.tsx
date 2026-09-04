import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ShoppingListDialog from './ShoppingListDialog'
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

const items = [
  { itemId: 1, groupId: 5, name: 'Latte', note: 'x6', toBuy: true },
  { itemId: 2, groupId: 5, name: 'Uova', toBuy: true },
  { itemId: 3, groupId: 5, name: 'Pane', toBuy: false },
]

function mockList(content = items, totalPages = 1) {
  mockedGet.mockResolvedValue({ data: { content, totalPages, number: 0 } })
}

function renderDialog() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ShoppingListDialog groupId={5} open onOpenChange={() => {}} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList()
})

describe('ShoppingListDialog', () => {
  it('mostra gli articoli del gruppo con nota e stato', async () => {
    renderDialog()

    expect(await screen.findByText('Latte')).toBeTruthy()
    expect(screen.getByText('x6')).toBeTruthy()
    expect(mockedGet).toHaveBeenCalledWith('/shopping-items/group/5', {
      params: { page: 0, size: 20 },
    })
    // checked = toBuy: gli acquistati sono deselezionati.
    expect(screen.getByLabelText('Da comprare: Latte')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Da comprare: Pane')).toHaveProperty('checked', false)
  })

  it('lista vuota: mostra il testo dedicato', async () => {
    mockList([])
    renderDialog()

    expect(await screen.findByText('Nessun articolo in lista.')).toBeTruthy()
  })

  it('il toggle chiama PUT con il nuovo valore di toBuy', async () => {
    mockedPut.mockResolvedValue({ data: { ...items[0], toBuy: false } })
    renderDialog()

    fireEvent.click(await screen.findByLabelText('Da comprare: Latte'))

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('/shopping-items/1', null, {
        params: { toBuy: false },
      }),
    )
  })

  it('elimina un articolo solo dopo la conferma inline', async () => {
    mockedDelete.mockResolvedValue({ data: {} })
    renderDialog()

    // Il primo tap mostra la conferma inline, senza chiamare il backend.
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina Uova' }))
    expect(screen.getByText('Eliminare?')).toBeTruthy()
    expect(mockedDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Conferma eliminazione Uova' }))
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('/shopping-items/2'))
  })

  it('annulla la conferma inline senza eliminare', async () => {
    renderDialog()

    fireEvent.click(await screen.findByRole('button', { name: 'Elimina Uova' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annulla eliminazione Uova' }))

    expect(mockedDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Elimina Uova' })).toBeTruthy()
  })

  it('aggiunge un articolo dal form inline', async () => {
    mockedPost.mockResolvedValue({ data: { itemId: 4, name: 'Pasta', toBuy: true } })
    renderDialog()

    fireEvent.click(await screen.findByRole('button', { name: /Aggiungi articolo/ }))
    fireEvent.change(screen.getByLabelText('Nome articolo'), { target: { value: 'Pasta' } })
    fireEvent.change(screen.getByLabelText('Quantità o nota'), { target: { value: '500g' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith('/shopping-items/new', null, {
        params: { groupId: 5, name: 'Pasta', note: '500g' },
      }),
    )
  })

  it('mostra inline l’errore di duplicato del backend', async () => {
    mockedPost.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: 'Articolo già presente in lista' } },
    })
    renderDialog()

    fireEvent.click(await screen.findByRole('button', { name: /Aggiungi articolo/ }))
    fireEvent.change(screen.getByLabelText('Nome articolo'), { target: { value: 'Latte' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))

    expect(await screen.findByText('Articolo già presente in lista')).toBeTruthy()
  })

  it('Esc annulla il form di aggiunta', async () => {
    renderDialog()

    fireEvent.click(await screen.findByRole('button', { name: /Aggiungi articolo/ }))
    fireEvent.keyDown(screen.getByLabelText('Nome articolo'), { key: 'Escape' })

    expect(screen.queryByLabelText('Nome articolo')).toBeNull()
    expect(screen.getByRole('button', { name: /Aggiungi articolo/ })).toBeTruthy()
  })

  it('mostra la paginazione solo con più pagine', async () => {
    mockList(items, 3)
    renderDialog()

    expect(await screen.findByText('Pagina 1 di 3')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Successivi' }))

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith('/shopping-items/group/5', {
        params: { page: 1, size: 20 },
      }),
    )
  })
})
