import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import type { components } from '../types'

type PageShoppingItemDTO = components['schemas']['PageShoppingItemDTO']
type ShoppingItemDTO = components['schemas']['ShoppingItemDTO']

const PAGE_SIZE = 20
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
