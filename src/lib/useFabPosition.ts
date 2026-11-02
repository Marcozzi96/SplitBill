import { useCallback, useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react'

const FAB_POSITION_KEY = 'splitbill_fab_position'
const FAB_POSITION_RESET_EVENT = 'splitbill:reset-fab-position'
const LONG_PRESS_MS = 1000
const SCREEN_MARGIN = 16
const BOTTOM_NAV_CLEARANCE = 96

type FabPosition = { x: number; y: number }

type Gesture = {
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

function clampPosition(position: FabPosition, element: HTMLElement): FabPosition {
  const rect = element.getBoundingClientRect()
  const maxX = Math.max(SCREEN_MARGIN, window.innerWidth - rect.width - SCREEN_MARGIN)
  const maxY = Math.max(
    SCREEN_MARGIN,
    window.innerHeight - rect.height - BOTTOM_NAV_CLEARANCE,
  )

  return {
    x: Math.min(maxX, Math.max(SCREEN_MARGIN, position.x)),
    y: Math.min(maxY, Math.max(SCREEN_MARGIN, position.y)),
  }
}

function readPosition(): FabPosition | null {
  try {
    const saved = localStorage.getItem(FAB_POSITION_KEY)
    if (!saved) return null
    const position: unknown = JSON.parse(saved)
    if (
      typeof position === 'object' &&
      position !== null &&
      'x' in position &&
      'y' in position &&
      typeof position.x === 'number' &&
      Number.isFinite(position.x) &&
      typeof position.y === 'number' &&
      Number.isFinite(position.y)
    ) {
      return { x: position.x, y: position.y }
    }
  } catch {
    return null
  }
  return null
}

export function resetFabPosition() {
  localStorage.removeItem(FAB_POSITION_KEY)
  window.dispatchEvent(new Event(FAB_POSITION_RESET_EVENT))
}

export function useFabPosition() {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const timerRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const [position, setPosition] = useState<FabPosition | null>(readPosition)
  const [dragging, setDragging] = useState(false)
  const positionRef = useRef(position)

  const updatePosition = useCallback((next: FabPosition) => {
    positionRef.current = next
    setPosition(next)
  }, [])

  const clearLongPress = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const finishDragging = useCallback(() => {
    clearLongPress()
    if (draggingRef.current && positionRef.current) {
      localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(positionRef.current))
    }
    draggingRef.current = false
    setDragging(false)
    gestureRef.current = null
  }, [clearLongPress])

  useEffect(() => {
    function handleResize() {
      if (!buttonRef.current || !positionRef.current) return
      updatePosition(clampPosition(positionRef.current, buttonRef.current))
    }

    function handleReset() {
      clearLongPress()
      gestureRef.current = null
      draggingRef.current = false
      positionRef.current = null
      setDragging(false)
      setPosition(null)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener(FAB_POSITION_RESET_EVENT, handleReset)
    return () => {
      clearLongPress()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener(FAB_POSITION_RESET_EVENT, handleReset)
    }
  }, [clearLongPress, updatePosition])

  useEffect(() => {
    if (!position || !buttonRef.current) return
    const clamped = clampPosition(position, buttonRef.current)
    if (clamped.x !== position.x || clamped.y !== position.y) updatePosition(clamped)
  }, [position, updatePosition])

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return
    clearLongPress()
    suppressClickRef.current = false
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: 0,
      offsetY: 0,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    timerRef.current = window.setTimeout(() => {
      const gesture = gestureRef.current
      const button = buttonRef.current
      if (!gesture || !button) return
      const rect = button.getBoundingClientRect()
      gesture.offsetX = gesture.startX - rect.left
      gesture.offsetY = gesture.startY - rect.top
      draggingRef.current = true
      suppressClickRef.current = true
      setDragging(true)
      updatePosition(clampPosition({ x: rect.left, y: rect.top }, button))
      navigator.vibrate?.(30)
    }, LONG_PRESS_MS)
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    if (!draggingRef.current) {
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 10) {
        clearLongPress()
      }
      return
    }

    event.preventDefault()
    if (buttonRef.current) {
      updatePosition(
        clampPosition(
          { x: event.clientX - gesture.offsetX, y: event.clientY - gesture.offsetY },
          buttonRef.current,
        ),
      )
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    if (draggingRef.current) event.preventDefault()
    finishDragging()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLButtonElement>) {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    finishDragging()
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!suppressClickRef.current) return false
    event.preventDefault()
    suppressClickRef.current = false
    return true
  }

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (!event.altKey || !buttonRef.current) return
      const delta = {
        ArrowLeft: { x: -16, y: 0 },
        ArrowRight: { x: 16, y: 0 },
        ArrowUp: { x: 0, y: -16 },
        ArrowDown: { x: 0, y: 16 },
      }[event.key]
      if (!delta) return

      event.preventDefault()
      const rect = buttonRef.current.getBoundingClientRect()
      const next = clampPosition(
        { x: rect.left + delta.x, y: rect.top + delta.y },
        buttonRef.current,
      )
      updatePosition(next)
      localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(next))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [updatePosition])

  return {
    buttonRef,
    position,
    dragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  }
}
