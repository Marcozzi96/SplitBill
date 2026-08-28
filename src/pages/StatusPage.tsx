import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useServerStatus } from '@/api/hooks/status'
import type { HttpStatus, ServerStatus } from '@/api/statusTypes'
import { getApiErrorMessage } from '@/api/errors'
import { formatBytes, formatBytesPerSecond } from '@/lib/bytes'
import { cn } from '@/lib/utils'

// 123456 -> "1g 10h 17m"; sotto il minuto mostra i secondi.
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}g ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${Math.floor(seconds)}s`
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`
}

function formatNumber(value: number): string {
  return value.toLocaleString('it-IT', { maximumFractionDigits: 1 })
}

interface ServerRates {
  rxBytesPerSecond: number
  txBytesPerSecond: number
  requestsPerMinute: number
  avgLatencyMs: number | null
  bytesInPerSecond: number
  bytesOutPerSecond: number
}

// Rate istantanei dai delta tra due poll consecutivi (i contatori sono cumulativi).
function computeRates(prev: ServerStatus, curr: ServerStatus): ServerRates | null {
  const dtSeconds = (Date.parse(curr.timestamp) - Date.parse(prev.timestamp)) / 1000
  if (!(dtSeconds > 0)) return null
  const deltaRequests = curr.http.requestsTotal - prev.http.requestsTotal
  return {
    rxBytesPerSecond: (curr.network.rxBytesTotal - prev.network.rxBytesTotal) / dtSeconds,
    txBytesPerSecond: (curr.network.txBytesTotal - prev.network.txBytesTotal) / dtSeconds,
    requestsPerMinute: (deltaRequests / dtSeconds) * 60,
    avgLatencyMs:
      deltaRequests > 0 ? (curr.http.totalTimeMs - prev.http.totalTimeMs) / deltaRequests : null,
    bytesInPerSecond: (curr.http.bytesInTotal - prev.http.bytesInTotal) / dtSeconds,
    bytesOutPerSecond: (curr.http.bytesOutTotal - prev.http.bytesOutTotal) / dtSeconds,
  }
}

// Il sample precedente resta in un ref: al primo poll i rate non sono disponibili.
function useServerRates(status: ServerStatus | undefined): ServerRates | null {
  const previousRef = useRef<ServerStatus | null>(null)
  const [rates, setRates] = useState<ServerRates | null>(null)
  useEffect(() => {
    if (!status) return
    const previous = previousRef.current
    previousRef.current = status
    if (previous) setRates(computeRates(previous, status))
  }, [status])
  return rates
}

export default function StatusPage() {
  const navigate = useNavigate()
  const statusQuery = useServerStatus()
  const status = statusQuery.data
  const rates = useServerRates(status)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Torna alle impostazioni"
          onClick={() => navigate('/settings')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">Stato server</h1>
      </div>

      {statusQuery.isPending && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            Caricamento stato del server…
          </CardContent>
        </Card>
      )}

      {statusQuery.isError && !status && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-destructive text-sm">{getApiErrorMessage(statusQuery.error)}</p>
            <Button variant="outline" className="h-11" onClick={() => statusQuery.refetch()}>
              Riprova
            </Button>
          </CardContent>
        </Card>
      )}

      {status && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="size-4" />
                {status.hostname}
              </CardTitle>
              <CardDescription>
                Ultimo aggiornamento:{' '}
                {new Date(status.timestamp).toLocaleTimeString('it-IT')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <MetricRow label="Uptime" value={formatUptime(status.uptimeSeconds)} />
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <RefreshCw className="size-3.5" />
                Aggiornamento automatico ogni 8 secondi
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="size-4" />
                  CPU
                </CardTitle>
                <CardDescription>{status.cpu.cores} core</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <span className="text-2xl font-bold">{formatPercent(status.cpu.usagePercent)}</span>
                <ProgressBar value={status.cpu.usagePercent} label="Uso CPU" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MemoryStick className="size-4" />
                  RAM
                </CardTitle>
                <CardDescription>
                  {formatBytes(status.memory.usedBytes)} di {formatBytes(status.memory.totalBytes)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <span className="text-2xl font-bold">
                  {formatPercent(status.memory.usagePercent)}
                </span>
                <ProgressBar value={status.memory.usagePercent} label="Uso RAM" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="size-4" />
                  Disco
                </CardTitle>
                <CardDescription>
                  {formatBytes(status.disk.usedBytes)} di {formatBytes(status.disk.totalBytes)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <span className="text-2xl font-bold">
                  {formatPercent(status.disk.usagePercent)}
                </span>
                <ProgressBar value={status.disk.usagePercent} label="Uso disco" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownUp className="size-4" />
                Rete
              </CardTitle>
              <CardDescription>Contatori totali dal boot del server</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <MetricRow label="Ricevuti" value={formatBytes(status.network.rxBytesTotal)} />
              <MetricRow label="Inviati" value={formatBytes(status.network.txBytesTotal)} />
              <Separator />
              <MetricRow
                label="Download"
                value={rates ? formatBytesPerSecond(rates.rxBytesPerSecond) : '—'}
              />
              <MetricRow
                label="Upload"
                value={rates ? formatBytesPerSecond(rates.txBytesPerSecond) : '—'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4" />
                Traffico HTTP
              </CardTitle>
              <CardDescription>
                {status.http.requestsTotal.toLocaleString('it-IT')} richieste totali
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <MetricRow
                label="Richieste/min"
                value={rates ? formatNumber(rates.requestsPerMinute) : '—'}
              />
              <MetricRow
                label="Latenza media"
                value={rates?.avgLatencyMs != null ? `${formatNumber(rates.avgLatencyMs)} ms` : '—'}
              />
              <MetricRow
                label="Banda in ingresso"
                value={rates ? formatBytesPerSecond(rates.bytesInPerSecond) : '—'}
              />
              <MetricRow
                label="Banda in uscita"
                value={rates ? formatBytesPerSecond(rates.bytesOutPerSecond) : '—'}
              />
              <Separator />
              <StatusCodeStats http={status.http} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

// Barra di avanzamento: non esiste un componente Progress in components/ui.
function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.min(100, Math.max(0, value))
  return (
    <div
      className="bg-muted h-2 w-full overflow-hidden rounded-full"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="bg-primary h-full rounded-full transition-[width]"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

// Ripartizione delle risposte per classe di status code (conteggio e %).
function StatusCodeStats({ http }: { http: HttpStatus }) {
  const entries = [
    { label: '2xx', count: http.requests2xx, className: 'text-success' },
    { label: '4xx', count: http.requests4xx, className: 'text-warning' },
    { label: '5xx', count: http.requests5xx, className: 'text-destructive' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {entries.map(({ label, count, className }) => (
        <div key={label} className="flex flex-col">
          <span className={cn('text-lg font-bold', className)}>
            {count.toLocaleString('it-IT')}
          </span>
          <span className="text-muted-foreground text-xs">
            {label} ·{' '}
            {http.requestsTotal > 0
              ? formatPercent((count / http.requestsTotal) * 100)
              : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}
