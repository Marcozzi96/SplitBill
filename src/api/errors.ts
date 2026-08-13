import axios from 'axios'

// Il backend risponde agli errori con { timestamp, status, error, message }.
// Il campo `message` è già in italiano e va mostrato all'utente.
// Sul 429 (rate limit di /auth/**) il body può mancare: messaggio dedicato.
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) {
      return 'Troppe richieste, riprovare tra poco'
    }
    const message = (error.response?.data as { message?: string } | undefined)?.message
    if (message) return message
    if (!error.response) return 'Errore di rete, riprovare'
  }
  return 'Si è verificato un errore, riprovare'
}
