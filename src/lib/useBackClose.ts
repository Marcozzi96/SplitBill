import { useEffect, useRef } from 'react'

// Pila globale dei layer "chiudibili col pulsante indietro" del telefono
// (dialog, tastierino del MoneyInput, popup delle Select). Ogni layer aperto
// spinge una voce nella cronologia del browser marcata col proprio id: il
// pulsante indietro consuma quella voce (popstate) e chiude il layer più in
// alto invece di navigare. Chiudendo il layer in altro modo (Esc, backdrop,
// "Fine") la voce di cronologia ancora corrente viene rimossa con
// history.back(), e il popstate che ne segue viene ignorato.

type StackEntry = { id: number; close: () => void }

const stack: StackEntry[] = []
let nextId = 1
let suppressNextPop = false
let listening = false

const STATE_KEY = '__backCloseId'

function currentId(): number | null {
  const state = window.history.state as Record<string, unknown> | null
  const id = state?.[STATE_KEY]
  return typeof id === 'number' ? id : null
}

function onPopstate() {
  if (suppressNextPop) {
    suppressNextPop = false
    return
  }
  const top = stack[stack.length - 1]
  // Se lo stato corrente è ancora quello del layer in cima, il pop riguarda
  // altre voci di cronologia; altrimenti la sua voce è stata consumata e il
  // layer va chiuso.
  if (!top || currentId() === top.id) return
  stack.pop()
  top.close()
}

// Chiama onClose quando l'utente preme il pulsante indietro mentre il layer è
// aperto. La chiusura tocca sempre e solo il layer più in alto della pila.
export function useBackClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    if (!listening) {
      window.addEventListener('popstate', onPopstate)
      listening = true
    }
    const id = nextId++
    stack.push({ id, close: () => onCloseRef.current() })
    // Mantiene lo stato esistente (es. l'indice interno di React Router).
    window.history.pushState({ ...(window.history.state ?? {}), [STATE_KEY]: id }, '')
    return () => {
      const index = stack.findIndex((entry) => entry.id === id)
      if (index === -1) return // già rimosso dal popstate che l'ha chiuso
      stack.splice(index, 1)
      if (currentId() === id) {
        suppressNextPop = true
        window.history.back()
      }
    }
  }, [open])
}
