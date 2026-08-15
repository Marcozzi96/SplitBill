import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import type { components } from '../types'

type PageGroupDTO = components['schemas']['PageGroupDTO']
type GroupDTO = components['schemas']['GroupDTO']
type GroupMemberDTO = components['schemas']['GroupMemberDTO']
type SettlementDTO = components['schemas']['SettlementDTO']

const PAGE_SIZE = 20
// Radice comune: le mutazioni invalidano tutte le query dei gruppi.
const GROUPS_ROOT = ['groups'] as const

export function useGroups(page: number) {
  return useQuery({
    queryKey: [...GROUPS_ROOT, 'list', page],
    queryFn: async () =>
      (await api.get<PageGroupDTO>('/groups', { params: { page, size: PAGE_SIZE } })).data,
    placeholderData: keepPreviousData,
  })
}

export function useGroup(groupId: number) {
  return useQuery({
    queryKey: [...GROUPS_ROOT, 'detail', groupId],
    queryFn: async () => (await api.get<GroupDTO>(`/groups/${groupId}`)).data,
  })
}

export function useGroupMembers(groupId: number) {
  return useQuery({
    queryKey: [...GROUPS_ROOT, 'members', groupId],
    queryFn: async () => (await api.get<GroupMemberDTO[]>(`/groups/${groupId}/members`)).data,
  })
}

// Debiti pendenti tra tutti i membri: caricato on-demand dal dialog di eliminazione (409).
export async function getGroupSettlementStatus(groupId: number) {
  return (await api.get<SettlementDTO[]>(`/groups/${groupId}/settlement-status`)).data
}

function useInvalidateGroups() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: GROUPS_ROOT })
}

export function useCreateGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    // name/description in query params, userId degli amici nel body come number[].
    mutationFn: async ({
      name,
      description,
      memberIds,
    }: {
      name: string
      description: string
      memberIds: number[]
    }) =>
      (await api.post<GroupDTO>('/groups/create', memberIds, { params: { name, description } }))
        .data,
    onSuccess: invalidate,
  })
}

export function useUpdateGroup(groupId: number) {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) =>
      (await api.put<GroupDTO>(`/groups/${groupId}`, null, { params: { name, description } }))
        .data,
    onSuccess: invalidate,
  })
}

export function useAddGroupMembers(groupId: number) {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: async (memberIds: number[]) =>
      (await api.post<GroupDTO>(`/groups/addUsers/${groupId}`, memberIds)).data,
    onSuccess: invalidate,
  })
}

export function useDeleteGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    // force=false: il backend risponde 409 se ci sono debiti pendenti;
    // il dialog mostra i debiti e consente il retry con force=true.
    mutationFn: async ({ groupId, force }: { groupId: number; force: boolean }) =>
      (await api.delete(`/groups/${groupId}`, { params: { force } })).data,
    onSuccess: (_data, { groupId }) => {
      // Il gruppo non esiste più: rimuovere le query di dettaglio (invalidarle
      // causerebbe refetch immediati e 404 a raffica mentre la pagina è montata).
      queryClient.removeQueries({ queryKey: [...GROUPS_ROOT, 'detail', groupId] })
      queryClient.removeQueries({ queryKey: [...GROUPS_ROOT, 'members', groupId] })
      queryClient.invalidateQueries({ queryKey: [...GROUPS_ROOT, 'list'] })
    },
  })
}

export function useLeaveGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: number) => (await api.delete(`/groups/leave/${groupId}`)).data,
    // Come la delete: dopo l'uscita il dettaglio non è più accessibile (404).
    onSuccess: (_data, groupId) => {
      queryClient.removeQueries({ queryKey: [...GROUPS_ROOT, 'detail', groupId] })
      queryClient.removeQueries({ queryKey: [...GROUPS_ROOT, 'members', groupId] })
      queryClient.invalidateQueries({ queryKey: [...GROUPS_ROOT, 'list'] })
    },
  })
}
