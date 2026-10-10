import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import type { components } from '../types'

type PageShoppingItemDTO = components['schemas']['PageShoppingItemDTO']
type ShoppingItemDTO = components['schemas']['ShoppingItemDTO']
type ShoppingItemPositionDTO = components['schemas']['ShoppingItemPositionDTO']

export const PAGE_SIZE = 20
const ALL_ITEMS_PAGE_SIZE = 500
// Radice comune: le mutazioni invalidano tutte le query della lista della spesa.
export const SHOPPING_ROOT = ['shopping'] as const

// Articoli del gruppo, ordinati dal server (attivi prima, poi acquistati).
// `toBuy` opzionale: true = solo da acquistare, false = solo acquistati.
// `size` sovrascrivibile (es. BillForm carica tutti gli attivi in una pagina).
export function useGroupShoppingItems(
  groupId: number,
  page: number,
  toBuy?: boolean,
  size: number = PAGE_SIZE,
  enabled = true,
) {
  return useQuery({
    queryKey: [...SHOPPING_ROOT, 'group', groupId, { page, toBuy, size }],
    queryFn: async () =>
      (
        await api.get<PageShoppingItemDTO>(`/shopping-items/group/${groupId}`, {
          params: { page, size, ...(toBuy != null ? { toBuy } : {}) },
        })
      ).data,
    placeholderData: keepPreviousData,
    enabled,
  })
}

// Carica TUTTI gli item della lista della spesa del gruppo. Spring non impone
// un page size massimo, ma usiamo pagine da 500 e accodiamo eventuali pagine
// successive per essere robusti anche con liste molto grandi.
export function useAllGroupShoppingItems(groupId: number, enabled = true) {
  const firstPage = useGroupShoppingItems(groupId, 0, undefined, ALL_ITEMS_PAGE_SIZE, enabled)
  const totalPages = firstPage.data?.totalPages ?? 0

  const remainingQueries = useQueries({
    queries: Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => {
      const page = i + 1
      return {
        queryKey: [...SHOPPING_ROOT, 'group', groupId, { page, toBuy: undefined, size: ALL_ITEMS_PAGE_SIZE }],
        queryFn: async () =>
          (
            await api.get<PageShoppingItemDTO>(`/shopping-items/group/${groupId}`, {
              params: { page, size: ALL_ITEMS_PAGE_SIZE },
            })
          ).data,
        enabled: enabled && firstPage.isSuccess && totalPages > 1,
      }
    }),
  })

  const isPending = firstPage.isPending || remainingQueries.some((q) => q.isPending)
  const isError = firstPage.isError || remainingQueries.some((q) => q.isError)
  const error = firstPage.error ?? remainingQueries.find((q) => q.error)?.error
  const allItems = [
    ...(firstPage.data?.content ?? []),
    ...remainingQueries.flatMap((q) => q.data?.content ?? []),
  ]

  return {
    data: allItems,
    isPending,
    isError,
    error,
    refetch: () => {
      firstPage.refetch()
      remainingQueries.forEach((q) => q.refetch())
    },
  }
}

function useInvalidateShopping() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: SHOPPING_ROOT })
}

export function useAddShoppingItem() {
  const invalidate = useInvalidateShopping()
  return useMutation({
    // Duplicati (case-insensitive, nello stesso gruppo): il backend risponde 400.
    mutationFn: async ({
      groupId,
      name,
      note,
    }: {
      groupId: number
      name: string
      note?: string
    }) =>
      (
        await api.post<ShoppingItemDTO>('/shopping-items/new', null, {
          params: { groupId, name, ...(note ? { note } : {}) },
        })
      ).data,
    onSuccess: invalidate,
  })
}

export function useToggleShoppingItem() {
  const invalidate = useInvalidateShopping()
  return useMutation({
    mutationFn: async ({ itemId, toBuy }: { itemId: number; toBuy: boolean }) =>
      (await api.put<ShoppingItemDTO>(`/shopping-items/${itemId}`, null, { params: { toBuy } }))
        .data,
    onSuccess: invalidate,
  })
}

export function useDeleteShoppingItem() {
  const invalidate = useInvalidateShopping()
  return useMutation({
    mutationFn: async (itemId: number) => (await api.delete(`/shopping-items/${itemId}`)).data,
    onSuccess: invalidate,
  })
}

// Ordine restituito dal backend: toBuy DESC, position DESC, id ASC.
function sortShoppingItems(a: ShoppingItemDTO, b: ShoppingItemDTO) {
  if (a.toBuy !== b.toBuy) return (a.toBuy ?? false) ? -1 : 1
  const posDiff = (b.position ?? 0) - (a.position ?? 0)
  if (posDiff !== 0) return posDiff
  return (a.itemId ?? 0) - (b.itemId ?? 0)
}

function updatePositionsInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: number,
  positions: ShoppingItemPositionDTO[],
) {
  const positionMap = new Map(positions.map((p) => [p.itemId, p.position]))
  const queries = queryClient.getQueriesData<PageShoppingItemDTO>({
    queryKey: [...SHOPPING_ROOT, 'group', groupId],
  })
  for (const [queryKey, data] of queries) {
    if (!data) continue
    const newContent = (data.content ?? [])
      .map((item) => {
        const newPosition = positionMap.get(item.itemId)
        return newPosition !== undefined ? { ...item, position: newPosition } : item
      })
      .sort(sortShoppingItems)
    queryClient.setQueryData(queryKey, { ...data, content: newContent })
  }
}

type ReorderVars = {
  groupId: number
  itemId: number
  prevItemId: number | null
  nextItemId: number | null
  newOrder: number[]
}

export function useReorderShoppingItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, prevItemId, nextItemId }: ReorderVars) =>
      (
        await api.patch<ShoppingItemPositionDTO[]>(`/shopping-items/${itemId}/position`, {
          prevItemId,
          nextItemId,
        })
      ).data,
    onMutate: async ({ groupId, newOrder }) => {
      const predicate = { queryKey: [...SHOPPING_ROOT, 'group', groupId] }
      await queryClient.cancelQueries(predicate)
      const previousQueries = queryClient.getQueriesData<PageShoppingItemDTO>(predicate)
      for (const [queryKey, data] of previousQueries) {
        if (!data) continue
        const content = data.content ?? []
        const bought = content.filter((i) => !i.toBuy)
        const toBuyById = new Map(content.filter((i) => i.toBuy).map((i) => [i.itemId, i]))
        const reorderedToBuy = newOrder
          .map((id) => toBuyById.get(id))
          .filter((i): i is ShoppingItemDTO => i != null)
        queryClient.setQueryData(queryKey, { ...data, content: [...reorderedToBuy, ...bought] })
      }
      return { previousQueries }
    },
    onError: (_err, _vars, context) => {
      if (!context?.previousQueries) return
      for (const [queryKey, data] of context.previousQueries) {
        if (data) queryClient.setQueryData(queryKey, data)
      }
    },
    onSuccess: (data, { groupId }) => {
      updatePositionsInCache(queryClient, groupId, data)
    },
  })
}
