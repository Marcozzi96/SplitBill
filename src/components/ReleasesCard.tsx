import { GitCommitHorizontal } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useLatestCommits, type GitHubCommit } from '@/api/hooks/github'

const REPOS = [
  { key: 'backend', label: 'Backend', repo: 'Marcozzi96/SplitBill_javaWS' },
  { key: 'frontend', label: 'Frontend', repo: 'Marcozzi96/SplitBill' },
] as const

// Card "Ultimi rilasci": gli ultimi 5 commit di main dei due repository GitHub.
// Le due sezioni sono query indipendenti: il fallimento di una non blocca l'altra.
export default function ReleasesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCommitHorizontal className="size-4" />
          Ultimi rilasci
        </CardTitle>
        <CardDescription>Gli ultimi 5 commit di main su GitHub</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {REPOS.map(({ key, label, repo }, index) => (
          <div key={key} className="flex flex-col gap-2">
            {index > 0 && <Separator />}
            <RepoCommits label={label} repo={repo} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function RepoCommits({ label, repo }: { label: string; repo: string }) {
  const commitsQuery = useLatestCommits(repo)

  return (
    <>
      <h3 className="text-sm font-medium">{label}</h3>
      {commitsQuery.isPending && (
        <p className="text-muted-foreground text-sm">Caricamento commit…</p>
      )}
      {commitsQuery.isError && (
        <p className="text-muted-foreground text-sm">
          Commit non disponibili: GitHub non risponde o il limite di richieste è stato raggiunto.
        </p>
      )}
      {commitsQuery.data && (
        <ul className="flex flex-col gap-2">
          {commitsQuery.data.map((commit) => (
            <CommitRow key={commit.sha} commit={commit} />
          ))}
        </ul>
      )}
    </>
  )
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CommitRow({ commit }: { commit: GitHubCommit }) {
  const firstLine = commit.commit.message.split('\n')[0]
  const author = commit.author?.login ?? commit.commit.author.name
  return (
    <li className="flex flex-col gap-0.5 text-sm">
      <div className="flex items-center gap-2">
        <a
          href={commit.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary shrink-0 py-1 font-mono text-xs underline-offset-4 hover:underline"
        >
          {commit.sha.slice(0, 7)}
        </a>
        <span className="min-w-0 flex-1 truncate">{firstLine}</span>
      </div>
      <span className="text-muted-foreground text-xs">
        {author} · {formatDateTime(commit.commit.author.date)}
      </span>
    </li>
  )
}
