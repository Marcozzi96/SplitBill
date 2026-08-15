import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import type { components } from '../types'

type PageUserDTO = components['schemas']['PageUserDTO']
type PageFriendshipReqRecDTO = components['schemas']['PageFriendshipReqRecDTO']
type PageFriendshipReqSenDTO = components['schemas']['PageFriendshipReqSenDTO']

const PAGE_SIZE = 20
// Radice comune: le mutazioni invalidano tutte le query delle amicizie.
const FRIENDS_ROOT = ['friends'] as const
export const FRIENDSHIP_COUNT_KEY = ['friendshipRequestsCount'] as const

export function useFriends(page: number) {
  return useQuery({
    queryKey: [...FRIENDS_ROOT, 'list', page],
    queryFn: async () =>
      (await api.get<PageUserDTO>('/user/getFriends', { params: { page, size: PAGE_SIZE } }))
        .data,
    placeholderData: keepPreviousData,
  })
}

export function useFriendshipReqReceived(page: number) {
  return useQuery({
    queryKey: [...FRIENDS_ROOT, 'received', page],
    queryFn: async () =>
      (
        await api.get<PageFriendshipReqRecDTO>('/user/getFriendshipReqReceived', {
          params: { page, size: PAGE_SIZE },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
}

export function useFriendshipReqSent(page: number) {
  return useQuery({
    queryKey: [...FRIENDS_ROOT, 'sent', page],
    queryFn: async () =>
      (
        await api.get<PageFriendshipReqSenDTO>('/user/getFriendshipReqSent', {
          params: { page, size: PAGE_SIZE },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
}

// Conteggio richieste ricevute in attesa: alimenta il badge sulla bottom navigation.
export function useFriendshipRequestsCount() {
  return useQuery({
    queryKey: FRIENDSHIP_COUNT_KEY,
    queryFn: async () =>
      (await api.get<{ count?: number }>('/user/friendshipRequests/count')).data.count ?? 0,
    refetchInterval: 60_000,
  })
}

function useInvalidateFriendships() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: FRIENDS_ROOT })
    queryClient.invalidateQueries({ queryKey: FRIENDSHIP_COUNT_KEY })
  }
}

export function useSendFriendshipRequest() {
  const invalidate = useInvalidateFriendships()
  return useMutation({
    // name = username o email; entrambi i dati viaggiano come query params.
    mutationFn: async ({ name, message }: { name: string; message: string }) =>
      (await api.post('/user/sendFriendshipRequest', null, { params: { name, message } })).data,
    onSuccess: invalidate,
  })
}

export function useAcceptFriendship() {
  const invalidate = useInvalidateFriendships()
  return useMutation({
    // friendId = userId del richiedente (applicant).
    mutationFn: async (friendId: number) =>
      (await api.put('/user/acceptFriendship', null, { params: { friendId } })).data,
    onSuccess: invalidate,
  })
}

export function useRefuseFriendship() {
  const invalidate = useInvalidateFriendships()
  return useMutation({
    // Rifiuta una richiesta ricevuta (friendId = applicant) oppure annulla
    // una richiesta inviata da noi (friendId = recipient).
    mutationFn: async (friendId: number) =>
      (await api.put('/user/refuseFriendship', null, { params: { friendId } })).data,
    onSuccess: invalidate,
  })
}

export function useCancelFriendship() {
  const invalidate = useInvalidateFriendships()
  return useMutation({
    // Rimuove un'amicizia già accettata.
    mutationFn: async (friendId: number) =>
      (await api.delete('/user/cancelFriendship', { params: { friendId } })).data,
    onSuccess: invalidate,
  })
}
