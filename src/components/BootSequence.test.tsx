import { render, screen, act, fireEvent } from '@testing-library/react'
import BootSequence from './BootSequence'

describe('BootSequence', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
    // jsdom non implementa matchMedia: lo mockiamo (nessuna reduced-motion).
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra le righe in sequenza e poi si smonta', () => {
    render(<BootSequence />)

    expect(screen.queryByText('$ splitbill --init')).toBeNull()

    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByText('$ splitbill --init')).toBeTruthy()

    act(() => vi.advanceTimersByTime(300 * 4))
    expect(screen.getByText('> pronto: che nessuno resti in debito')).toBeTruthy()

    // Dopo l'ultima riga: pausa + fade, poi l'overlay sparisce.
    act(() => vi.advanceTimersByTime(650 + 350))
    expect(screen.queryByText('$ splitbill --init')).toBeNull()
    expect(sessionStorage.getItem('splitbill_booted')).toBe('1')
  })

  it('non si ripete nella stessa sessione', () => {
    sessionStorage.setItem('splitbill_booted', '1')
    render(<BootSequence />)

    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByText('$ splitbill --init')).toBeNull()
  })

  it('il tocco salta la sequenza', () => {
    const { container } = render(<BootSequence />)

    act(() => vi.advanceTimersByTime(300))
    fireEvent.click(container.querySelector('[role="presentation"]')!)

    expect(screen.queryByText('$ splitbill --init')).toBeNull()
  })
})
