import { useQuery } from '@tanstack/react-query'
import { api } from '../client'
import type { ServerStatus } from '../statusTypes'

// Stato del server (CPU, RAM, disco, rete, traffico HTTP) con polling automatico.
// JWT e gestione del 401 arrivano dagli interceptor di client.ts.
export function useServerStatus() {
  return useQuery({
    queryKey: ['status', 'server'],
    queryFn: async () => (await api.get<ServerStatus>('/api/status')).data,
    refetchInterval: 8_000,
  })
}
