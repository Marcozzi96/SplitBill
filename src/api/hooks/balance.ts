import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import type { components } from '../types'

type UserBalanceDTO = components['schemas']['UserBalanceDTO']
type UserSettlementDTO = components['schemas']['UserSettlementDTO']
type PagePaymentDTO = components['schemas']['PagePaymentDTO']
type PaymentDTO = components['schemas']['PaymentDTO']

const PAGE_SIZE = 20
// Radice comune dei bilanci globali; quelli di gruppo vivono sotto ['groups', ...]
// così le mutazioni delle spese (che invalidano 'groups' e 'balance') aggiornano tutto.
const BALANCE_ROOT = ['balance'] as const
const GROUPS_ROOT = ['groups'] as const
const PAYMENTS_ROOT = ['payments'] as const

// Saldo globale dell'utente autenticato.
export function useMyBalance() {
  return useQuery({
    queryKey: [...BALANCE_ROOT, 'me'],
    queryFn: async () => (await api.get<UserBalanceDTO>('/balance/me')).data,
  })
}

// "Chi deve a chi" globale, dal punto di vista dell'utente autenticato.
export function useMySettlements() {
  return useQuery({
    queryKey: [...BALANCE_ROOT, 'settlements'],
    queryFn: async () => (await api.get<UserSettlementDTO[]>('/balance/settlements')).data,
  })
}

// Saldo dell'utente autenticato nel gruppo.
export function useGroupBalance(groupId: number) {
  return useQuery({
    queryKey: [...GROUPS_ROOT, 'balance', groupId],
    queryFn: async () => (await api.get<UserBalanceDTO>(`/groups/${groupId}/balance`)).data,
  })
}

// "Chi deve a chi" nel gruppo, dal punto di vista dell'utente autenticato.
export function useGroupSettlements(groupId: number) {
  return useQuery({
    queryKey: [...GROUPS_ROOT, 'settlements', groupId],
    queryFn: async () =>
      (await api.get<UserSettlementDTO[]>(`/groups/${groupId}/settlements`)).data,
  })
}

// Cronologia rimborsi (paginata) in cui l'utente è payer o payee.
export function usePayments(page: number) {
  return useQuery({
    queryKey: [...PAYMENTS_ROOT, 'list', page],
    queryFn: async () =>
      (await api.get<PagePaymentDTO>('/payments', { params: { page, size: PAGE_SIZE } })).data,
    placeholderData: keepPreviousData,
  })
}

// Rimborso: payer = utente autenticato. Il groupId va passato sempre se il debito
// è di gruppo: senza groupId il backend salda solo i debiti personali.
// Il backend risponde 409 se l'importo supera il debito effettivo.
export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      payeeId,
      amount,
      groupId,
      notes,
    }: {
      payeeId: number
      amount: number
      groupId?: number
      notes?: string
    }) =>
      (
        await api.post<PaymentDTO>('/payments', null, {
          params: {
            payeeId,
            amount,
            ...(groupId != null ? { groupId } : {}),
            ...(notes ? { notes } : {}),
          },
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BALANCE_ROOT })
      queryClient.invalidateQueries({ queryKey: GROUPS_ROOT })
      queryClient.invalidateQueries({ queryKey: PAYMENTS_ROOT })
    },
  })
}

// Il creditore (utente autenticato) "dimentica" l'intero debito che un utente
// ELIMINATO ha verso di lui: il backend lo estingue con un Payment automatico.
// 400 se il payer non è eliminato o non ha debiti; 404 se inesistente.
export function useForgiveDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ payerId, groupId }: { payerId: number; groupId?: number }) =>
      (
        await api.post<PaymentDTO>('/payments/forgive', null, {
          params: { payerId, groupId },
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BALANCE_ROOT })
      queryClient.invalidateQueries({ queryKey: GROUPS_ROOT })
      queryClient.invalidateQueries({ queryKey: PAYMENTS_ROOT })
    },
  })
}
