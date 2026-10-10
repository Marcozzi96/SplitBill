import * as React from "react"

import { cn } from "@/lib/utils"

// Checkbox nativo ritematizzato (appearance-none): la spunta è il glifo "✕",
// coerente con l'estetica ASCII da terminale. Resta un vero
// <input type="checkbox">: label, tastiera e screen reader invariati.
const Checkbox = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        data-slot="checkbox"
        className={cn(
          "grid size-4 shrink-0 cursor-pointer appearance-none place-items-center rounded-sm border border-input bg-transparent outline-none transition-colors dark:bg-input/30",
          "before:scale-0 before:text-[10px] before:leading-none before:font-bold before:transition-transform before:content-['✕']",
          "checked:border-primary checked:bg-primary checked:text-primary-foreground checked:before:scale-100 dark:checked:bg-primary",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)

export { Checkbox }
