import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/api/errors'
import {
  useAddShoppingItem,
  useAllGroupShoppingItems,
  useDeleteShoppingItem,
  useReorderShoppingItem,
  useToggleShoppingItem,
} from '@/api/hooks/shopping'
import type { components } from '@/api/types'

type ShoppingItemDTO = components['schemas']['ShoppingItemDTO']

// Lista della spesa del gruppo: aperta dal dettaglio gruppo, visibile a tutti
// i membri. I "da acquistare" (toBuy=true) sono ordinabili con drag&drop;
// gli acquistati (toBuy=false) sono in una sezione statica in fondo.
// L'ordine arriva già dal backend (toBuy DESC, position DESC, id ASC).
export default function ShoppingListDialog({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [activeId, setActiveId] = useState<number | null>(null)

  // La query parte solo a dialog aperto: il componente resta montato anche da chiuso.
  const itemsQuery = useAllGroupShoppingItems(groupId, open)
  const toggleMutation = useToggleShoppingItem()
  const deleteMutation = useDeleteShoppingItem()
  const reorderMutation = useReorderShoppingItem()

  const items = itemsQuery.data ?? []

  const toBuyItems = items.filter((i) => i.toBuy)
  const boughtItems = items.filter((i) => !i.toBuy)
  const toBuyIds = toBuyItems.map((i) => i.itemId!)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeId = Number(active.id)
    const overId = Number(over.id)
    if (Number.isNaN(activeId) || Number.isNaN(overId) || activeId === overId) return

    const activeIndex = toBuyItems.findIndex((i) => i.itemId === activeId)
    const overIndex = toBuyItems.findIndex((i) => i.itemId === overId)
    if (activeIndex === -1 || overIndex === -1) return

    const reordered = arrayMove(toBuyItems, activeIndex, overIndex)
    const newIndex = reordered.findIndex((i) => i.itemId === activeId)
    const prevItemId = reordered[newIndex - 1]?.itemId ?? null
    const nextItemId = reordered[newIndex + 1]?.itemId ?? null

    reorderMutation.mutate(
      {
        groupId,
        itemId: activeId,
        prevItemId,
        nextItemId,
        newOrder: reordered.map((i) => i.itemId!),
      },
      {
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    )
  }

  const activeItem = activeId != null ? toBuyItems.find((i) => i.itemId === activeId) : undefined

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
            <div className="flex flex-col gap-4">
              {items.length === 0 && (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  Nessun articolo in lista.
                </p>
              )}

              {toBuyItems.length > 0 && (
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={toBuyIds} strategy={verticalListSortingStrategy}>
                    <ul className="flex flex-col gap-1">
                      {toBuyItems.map((item) => (
                        <SortableShoppingItemRow
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
                  </SortableContext>

                  {createPortal(
                    <DragOverlay>
                      {activeItem ? (
                        <ShoppingItemRowBase
                          item={activeItem}
                          onToggle={() => {}}
                          onDelete={() => {}}
                          deleting={false}
                        />
                      ) : null}
                    </DragOverlay>,
                    document.body,
                  )}
                </DndContext>
              )}

              {toBuyItems.length === 0 && boughtItems.length > 0 && (
                <p className="text-muted-foreground py-2 text-center text-sm">
                  Nessun articolo da comprare.
                </p>
              )}

              {boughtItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-xs uppercase">Comprati</p>
                  <Card className="bg-muted/30">
                    <CardContent className="py-2">
                      <ul className="flex flex-col gap-1">
                        {boughtItems.map((item) => (
                          <StaticShoppingItemRow
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
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogBody>
        {/* Footer fisso (fuori dallo scroll): aggiunta inline. */}
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
          <AddItemRow groupId={groupId} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShoppingItemRowBase({
  item,
  onToggle,
  onDelete,
  deleting,
  dragHandle,
  className,
}: {
  item: ShoppingItemDTO
  onToggle: (toBuy: boolean) => void
  onDelete: () => void
  deleting: boolean
  dragHandle?: React.ReactNode
  className?: string
}) {
  const bought = item.toBuy === false
  const [confirming, setConfirming] = useState(false)

  return (
    <li
      className={cn(
        'flex min-h-11 items-center gap-1 rounded-md px-2 transition-colors',
        !bought && 'hover:bg-muted',
        className,
      )}
    >
      {dragHandle}
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <Checkbox
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

function SortableShoppingItemRow({
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.itemId!,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ShoppingItemRowBase
        item={item}
        onToggle={onToggle}
        onDelete={onDelete}
        deleting={deleting}
        className={cn(isDragging && 'bg-muted/50 opacity-60')}
        dragHandle={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label={`Trascina ${item.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-5" />
          </Button>
        }
      />
    </div>
  )
}

function StaticShoppingItemRow({
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
  return (
    <ShoppingItemRowBase
      item={item}
      onToggle={onToggle}
      onDelete={onDelete}
      deleting={deleting}
    />
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
