// Segnaposto per le schermate in arrivo negli sprint successivi
// (vedi piano_di_sviluppo.md e progettazione-fe.md §4).
export default function PlaceholderPage({
  title,
  sprint,
}: {
  title: string
  sprint: string
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground mt-2">{sprint}</p>
    </div>
  )
}
