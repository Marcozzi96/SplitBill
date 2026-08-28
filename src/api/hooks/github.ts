import { useQuery } from '@tanstack/react-query'

// Risposta di GitHub REST: GET /repos/{owner}/{repo}/commits
export interface GitHubCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author: { name: string; date: string }
  }
  // Utente GitHub autore del commit: null se non associato a un account.
  author: { login: string } | null
}

const PER_PAGE = 5
const STALE_TIME_MS = 5 * 60 * 1000

// Ultimi commit di main di un repository GitHub pubblico.
// Usa fetch nativo e NON l'istanza axios di client.ts: l'interceptor JWT
// aggiungerebbe Authorization a un dominio esterno. API pubblica, CORS aperto,
// nessuna autenticazione — rate limit 60 req/ora per IP: per questo staleTime
// lungo e NESSUN refetchInterval (il polling della StatusPage non deve arrivare
// a GitHub).
export function useLatestCommits(repo: string) {
  return useQuery({
    queryKey: ['github', 'commits', repo],
    queryFn: async () => {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/commits?sha=main&per_page=${PER_PAGE}`,
      )
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }
      return (await response.json()) as GitHubCommit[]
    },
    staleTime: STALE_TIME_MS,
  })
}
