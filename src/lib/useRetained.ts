import { useState } from 'react'

// Trattiene l'ultimo valore non-null ricevuto: per i dialog pilotati da uno
// stato nullable (es. `bill && <Dialog …>`), così il Dialog resta montato
// durante l'animazione di chiusura (Base UI non anima se il Root viene
// smontato appena lo stato torna null).
export function useRetained<T>(value: T | null): T | null {
  const [retained, setRetained] = useState<T | null>(null)
  if (value != null && value !== retained) setRetained(value)
  return value ?? retained
}

// Conta le aperture (transizioni false→true). Come `key` sul contenuto di un
// dialog lo rimonta a ogni apertura, resettando lo stato interno dei form,
// senza smontare il Root durante la chiusura.
export function useOpenCount(open: boolean): number {
  const [count, setCount] = useState(0)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setCount((c) => c + 1)
  }
  return count
}
