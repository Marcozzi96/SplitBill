import * as React from "react"

import { cn } from "@/lib/utils"

// Select nativo ritematizzato: il trigger ha l'estetica da terminale
// (appearance-none + indicatore "▾"), il menu resta quello del sistema
// operativo — tastiera e screen reader funzionano senza logica custom.
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          data-slot="select"
          className={cn(
            "h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent px-2.5 py-1 pr-8 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <span
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs"
        >
          ▾
        </span>
      </div>
    )
  }
)

export { Select }
