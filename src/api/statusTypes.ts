// Contratto di GET /api/status (endpoint di monitoraggio del backend).
// NON generato da openapi-typescript: types.ts resta riservato ai tipi generati.

export interface ServerStatus {
  timestamp: string
  hostname: string
  uptimeSeconds: number
  cpu: CpuStatus
  memory: ResourceUsage
  disk: ResourceUsage
  network: NetworkStatus
  http: HttpStatus
}

export interface CpuStatus {
  cores: number
  usagePercent: number
}

export interface ResourceUsage {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
}

// Contatori CUMULATIVI dal boot del server: i rate si ricavano dai delta tra poll.
export interface NetworkStatus {
  rxBytesTotal: number
  txBytesTotal: number
}

export interface HttpStatus {
  requestsTotal: number
  bytesInTotal: number
  bytesOutTotal: number
  requests2xx: number
  requests4xx: number
  requests5xx: number
  totalTimeMs: number
}
