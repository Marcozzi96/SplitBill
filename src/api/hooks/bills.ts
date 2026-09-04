import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import type { components } from '../types'

type PageBillDTO = components['schemas']['PageBillDTO']
type BillDTO = components['schemas']['BillDTO']

const PAGE_SIZE = 20
// Radice comune: le mutazioni invalidano tutte le query delle spese.
const BILLS_ROOT = ['bills'] as const

export function useGroupBills(groupId: number, page: number) {
  return useQuery({
    queryKey: [...BILLS_ROOT, 'group', groupId, page],
    queryFn: async () =>
      (await api.get<PageBillDTO>(`/bills/group/${groupId}`, { params: { page, size: PAGE_SIZE } }))
        .data,
    placeholderData: keepPreviousData,
  })
}

// Spese in cui l'utente è coinvolto (come buyer o debitore).
export function useMyBills(page: number) {
  return useQuery({
    queryKey: [...BILLS_ROOT, 'mine', page],
    queryFn: async () =>
      (await api.get<PageBillDTO>('/bills/getMyBills', { params: { page, size: PAGE_SIZE } })).data,
    placeholderData: keepPreviousData,
  })
}

// Spese pagate dall'utente.
export function useBillsWhereImBuyer(page: number) {
  return useQuery({
    queryKey: [...BILLS_ROOT, 'buyer', page],
    queryFn: async () =>
      (
        await api.get<PageBillDTO>('/bills/getWhereImBuyer', {
          params: { page, size: PAGE_SIZE },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
}

// Dati della spesa in query params, ripartizione (userId -> importo) nel body.
export interface BillInput {
  description: string
  amount: number
  notes: string
  shares: Record<number, number>
  /** Chi ha pagato; se assente vale l'utente autenticato (create) o il buyer attuale (update). */
  buyerId?: number
}

function useInvalidateBills() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: BILLS_ROOT })
    // Le spese cambiano i bilanci: invalidare anche gruppi (bilancio/settlement
    // nel dettaglio) e la radice 'balance' usata dallo Sprint 6.
    queryClient.invalidateQueries({ queryKey: ['groups'] })
    queryClient.invalidateQueries({ queryKey: ['balance'] })
    // La creazione può marcare articoli della lista spesa come acquistati.
    queryClient.invalidateQueries({ queryKey: ['shopping'] })
  }
}

export function useCreateBill() {
  const invalidate = useInvalidateBills()
  return useMutation({
    // groupId opzionale: senza gruppo la spesa è personale (es. tra amici).
    // shoppingItemIds (param ripetuto): articoli della lista spesa acquistati.
    mutationFn: async ({
      groupId,
      shoppingItemIds,
      ...input
    }: BillInput & { groupId?: number; shoppingItemIds?: number[] }) =>
      (
        await api.post<BillDTO>('/bills/new', input.shares, {
          params: {
            description: input.description,
            amount: input.amount,
            notes: input.notes,
            ...(groupId != null ? { groupId } : {}),
            ...(input.buyerId != null ? { buyerId: input.buyerId } : {}),
            ...(shoppingItemIds && shoppingItemIds.length > 0 ? { shoppingItemIds } : {}),
          },
          // Param ripetuto (shoppingItemIds=1&shoppingItemIds=2), non con []:
          // è il formato atteso da Spring per List<Long>. Solo quando serve.
          ...(shoppingItemIds && shoppingItemIds.length > 0
            ? { paramsSerializer: { indexes: null } }
            : {}),
        })
      ).data,
    onSuccess: invalidate,
  })
}

export function useUpdateBill(billId: number) {
  const invalidate = useInvalidateBills()
  return useMutation({
    mutationFn: async (input: BillInput) =>
      (
        await api.put<BillDTO>(`/bills/${billId}`, input.shares, {
          params: {
            description: input.description,
            amount: input.amount,
            notes: input.notes,
            ...(input.buyerId != null ? { buyerId: input.buyerId } : {}),
          },
        })
      ).data,
    onSuccess: invalidate,
  })
}

export function useDeleteBill() {
  const invalidate = useInvalidateBills()
  return useMutation({
    mutationFn: async (billId: number) => (await api.delete(`/bills/${billId}`)).data,
    onSuccess: invalidate,
  })
}
