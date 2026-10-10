import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useReorderShoppingItem, SHOPPING_ROOT, PAGE_SIZE } from './shopping'
import { api } from '@/api/client'

vi.mock('@/api/client', () => ({
  TOKEN_KEY: 'splitbill_token',
  api: {
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

const mockedPatch = vi.mocked(api.patch)

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useReorderShoppingItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chiama PATCH /shopping-items/{itemId}/position con prevItemId e nextItemId', async () => {
    mockedPatch.mockResolvedValue({ data: [] })

    const { result } = renderHook(() => useReorderShoppingItem(), { wrapper })

    result.current.mutate({
      groupId: 5,
      itemId: 2,
      prevItemId: 1,
      nextItemId: 3,
      newOrder: [1, 2, 3],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedPatch).toHaveBeenCalledWith('/shopping-items/2/position', {
      prevItemId: 1,
      nextItemId: 3,
    })
  })

  it('aggiorna le position in cache dalla response senza rifare GET', async () => {
    const items = [
      { itemId: 1, groupId: 5, name: 'Latte', toBuy: true, position: 100 },
      { itemId: 2, groupId: 5, name: 'Uova', toBuy: true, position: 50 },
      { itemId: 3, groupId: 5, name: 'Pane', toBuy: false, position: 25 },
    ]

    mockedPatch.mockResolvedValue({
      data: [
        { itemId: 1, position: 200 },
        { itemId: 2, position: 150 },
        { itemId: 3, position: 25 },
      ],
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const queryKey = [...SHOPPING_ROOT, 'group', 5, { page: 0, toBuy: undefined, size: PAGE_SIZE }]
    queryClient.setQueryData(queryKey, { content: items, totalPages: 1, number: 0 })

    function customWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }

    const { result } = renderHook(() => useReorderShoppingItem(), { wrapper: customWrapper })

    result.current.mutate({
      groupId: 5,
      itemId: 2,
      prevItemId: 1,
      nextItemId: null,
      newOrder: [1, 2],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = queryClient.getQueryData<{ content: { itemId: number; position: number; toBuy: boolean }[] }>(queryKey)
    expect(cached?.content.find((i) => i.itemId === 2)?.position).toBe(150)
    expect(cached?.content.find((i) => i.itemId === 1)?.position).toBe(200)
  })
})
