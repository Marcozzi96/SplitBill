// Formattazione di quantità di byte in unità leggibili (1 KB = 1024 byte).

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

// 0 -> "0 B", 1536 -> "1,5 KB". Locale it-IT; niente decimali per i byte.
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const unitIndex = Math.min(Math.max(Math.floor(Math.log2(bytes) / 10), 0), UNITS.length - 1)
  const value = bytes / 1024 ** unitIndex
  const formatted = value.toLocaleString('it-IT', {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  })
  return `${formatted} ${UNITS[unitIndex]}`
}

// Rate di trasferimento (byte/s): 2048 -> "2 KB/s".
export function formatBytesPerSecond(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}
