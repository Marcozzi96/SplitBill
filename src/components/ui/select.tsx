"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { useBackClose } from "@/lib/useBackClose"

// Select custom su Base UI: il menu è interamente ritematizzato come un menu
// curses (riga evidenziata invertita verde/blu-nero, marcatore ">" sulla voce
// selezionata) al posto della tendina del sistema operativo. Tastiera,
// typeahead e screen reader restano gestiti da Base UI.
function Select({
  id,
  value,
  onValueChange,
  placeholder,
  disabled,
  className,
  children,
}: {
  id?: string
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: React.ReactNode
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}) {
  // Registro valore → label: permette a Value di mostrare il testo della voce
  // selezionata anche prima che il popup sia stato aperto una prima volta.
  const items: Record<string, React.ReactNode> = {}
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<{ value: string; children?: React.ReactNode }>(child)) {
      items[String(child.props.value)] = child.props.children
    }
  })

  // Apertura controllata internamente: il pulsante indietro del telefono deve
  // poter chiudere il popup senza navigare (come per i Dialog).
  const [open, setOpen] = React.useState(false)
  useBackClose(open, () => setOpen(false))

  return (
    <SelectPrimitive.Root
      items={items}
      value={value === "" || value == null ? null : value}
      onValueChange={(v) => onValueChange?.(v == null ? "" : String(v))}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select-trigger"
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex h-8 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
      >
        <SelectPrimitive.Value
          placeholder={placeholder}
          className="data-placeholder:text-muted-foreground min-w-0 flex-1 truncate"
        />
        <SelectPrimitive.Icon aria-hidden className="text-muted-foreground text-xs">
          ▾
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} className="z-50 outline-none">
          <SelectPrimitive.Popup
            data-slot="select-content"
            className="bg-popover text-popover-foreground ring-border data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-lg py-1 text-sm shadow-lg shadow-black/30 ring-1 outline-none duration-100"
          >
            {children}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

// Voce del menu: gutter a sinistra per il marcatore di selezione ">",
// evidenziazione a riga intera invertita (stile selection bar da CLI).
function SelectItem({
  value,
  disabled,
  className,
  children,
}: {
  value: string
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      disabled={disabled}
      data-slot="select-item"
      className={cn(
        "data-highlighted:bg-primary data-highlighted:text-primary-foreground relative flex cursor-pointer items-center py-1.5 pr-2.5 pl-7 outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2 text-xs font-bold">
        <span aria-hidden>&gt;</span>
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="truncate">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectItem }
