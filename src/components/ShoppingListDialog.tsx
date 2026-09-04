import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Check, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/api/errors'
import {
  useAddShoppingItem,
  useDeleteShoppingItem,
  useGroupShoppingItems,
  useToggleShoppingItem,
} from '@/api/hooks/shopping'
import type { components } from '@/api/types'

type ShoppingItemDTO = components['schemas']['ShoppingItemDTO']

// Lista della spesa del gruppo: aperta dal dettaglio gruppo, visibile a tutti
// i membri. Checkbox = ancora da acquistare (toBuy); gli articoli acquistati
// (toBuy=false) sono barrati e arrivano in fondo dal server.
export default function ShoppingListDialog({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [page, setPage] = useState(0)
  // La query parte solo a dialog aperto: il componente resta montato anche da chiuso.
  const itemsQuery = useGroupShoppingItems(groupId, page, undefined, undefined, open)
  const toggleMutation = useToggleShoppingItem()
  const deleteMutation = useDeleteShoppingItem()

  const items = itemsQuery.data?.content ?? []
  const totalPages = itemsQuery.data?.totalPages ?? 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lista della spesa</DialogTitle>
          <DialogDescription>
            Articoli da acquistare condivisi tra i membri del gruppo.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {itemsQuery.isPending ? (
            <div className="flex justify-center py-6">
              <LoaderCircle className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : itemsQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-muted-foreground">{getApiErrorMessage(itemsQuery.error)}</p>
              <Button variant="outline" size="sm" onClick={() => itemsQuery.refetch()}>
                Riprova
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.length === 0 && (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  Nessun articolo in lista.
                </p>
              )}
              <ul className="flex flex-col">
                {items.map((item) => (
                  <ShoppingItemRow
                    key={item.itemId}
                    item={item}
                    onToggle={(toBuy) =>
                      toggleMutation.mutate(
                        { itemId: item.itemId!, toBuy },
                        { onError: (err) => toast.error(getApiErrorMessage(err)) },
                      )
                    }
                    onDelete={() =>
                      deleteMutation.mutate(item.itemId!, {
                        onError: (err) => toast.error(getApiErrorMessage(err)),
                      })
                    }
                    deleting={deleteMutation.isPending}
                  />
                ))}
              </ul>
            </div>
          )}
        </DialogBody>
        {/* Footer fisso (fuori dallo scroll): aggiunta inline e paginazione. */}
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
          <AddItemRow groupId={groupId} />
          {totalPages > 1 && (
            <div className="flex w-full items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Precedenti
              </Button>
              <span className="text-muted-foreground text-sm">
                Pagina {page + 1} di {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Successivi
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShoppingItemRow({
  item,
  onToggle,
  onDelete,
  deleting,
}: {
  item: ShoppingItemDTO
  onToggle: (toBuy: boolean) => void
  onDelete: () => void
  deleting: boolean
}) {
  const bought = item.toBuy === false
  // Conferma inline: il primo tap sul cestino mostra conferma/annulla nella riga.
  const [confirming, setConfirming] = useState(false)
  return (
    <li className="border-border flex items-center gap-1 border-b py-1 last:border-b-0">
      <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="size-4 shrink-0"
          checked={item.toBuy ?? false}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Da comprare: ${item.name}`}
        />
        <span className="min-w-0">
          <span
            className={cn(
              'block truncate text-sm',
              bought && 'text-muted-foreground line-through',
            )}
          >
            {item.name}
          </span>
          {item.note && (
            <span
              className={cn(
                'text-muted-foreground block truncate text-xs',
                bought && 'line-through',
              )}
            >
              {item.note}
            </span>
          )}
        </span>
      </label>
      {confirming ? (
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-muted-foreground text-xs">Eliminare?</span>
          <Button
            variant="destructive"
            size="icon"
            className="size-11"
            aria-label={`Conferma eliminazione ${item.name}`}
            disabled={deleting}
            onClick={onDelete}
          >
            <Check />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Annulla eliminazione ${item.name}`}
            disabled={deleting}
            onClick={() => setConfirming(false)}
          >
            <X />
          </Button>
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`Elimina ${item.name}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2 />
        </Button>
      )}
    </li>
  )
}

// Riga finale: pulsante che apre il form inline di aggiunta (Enter conferma,
// Esc annulla). Il duplicato (400 dal backend) è mostrato sotto il form.
function AddItemRow({ groupId }: { groupId: number }) {
  const addMutation = useAddShoppingItem()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setEditing(false)
    setName('')
    setNote('')
    setError(null)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    addMutation.mutate(
      { groupId, name: name.trim(), note: note.trim() || undefined },
      {
        onSuccess: reset,
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    )
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') reset()
  }

  if (!editing) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>
        <Plus />
        Aggiungi articolo
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          required
          autoFocus
          placeholder="Nome articolo"
          aria-label="Nome articolo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Input
          placeholder="Quantità o nota"
          aria-label="Quantità o nota"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {error && <FieldError>{error}</FieldError>}
      <div className="flex gap-2">
        <Button
          type="submit"
          className="flex-1"
          disabled={!name.trim() || addMutation.isPending}
        >
          {addMutation.isPending ? 'Aggiunta in corso…' : 'Aggiungi'}
        </Button>
        <Button type="button" variant="outline" onClick={reset}>
          Annulla
        </Button>
      </div>
    </form>
  )
}
