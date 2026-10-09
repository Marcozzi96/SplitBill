import { act, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useBackClose } from './useBackClose'

function Layer({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true)
  useBackClose(open, () => {
    setOpen(false)
    onClose()
  })
  return <span data-testid="state">{open ? 'open' : 'closed'}</span>
}

async function pressBack() {
  await act(async () => {
    window.history.back()
    // jsdom processa la traversata della cronologia (e il popstate) in modo
    // asincrono.
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

describe('useBackClose', () => {
  it('il pulsante indietro chiude il layer aperto', async () => {
    const onClose = vi.fn()
    render(<Layer onClose={onClose} />)

    await pressBack()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('una chiusura normale (Esc, backdrop) consuma la voce: il back non richiude', async () => {
    const onClose = vi.fn()
    function Harness() {
      const [open, setOpen] = useState(true)
      useBackClose(open, onClose)
      return (
        <button type="button" onClick={() => setOpen(false)}>
          chiudi
        </button>
      )
    }
    render(<Harness />)

    // Chiusura "programmatica": la voce di cronologia viene rimossa dall'hook.
    act(() => screen.getByRole('button').click())
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    await pressBack()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('con due layer in pila il back chiude solo quello più in alto', async () => {
    const onCloseA = vi.fn()
    const onCloseB = vi.fn()
    render(
      <>
        <Layer onClose={onCloseA} />
        <Layer onClose={onCloseB} />
      </>,
    )

    await pressBack()

    expect(onCloseB).toHaveBeenCalledTimes(1)
    expect(onCloseA).not.toHaveBeenCalled()

    await waitFor(() => expect(screen.getAllByTestId('state')[1].textContent).toBe('closed'))
    expect(screen.getAllByTestId('state')[0].textContent).toBe('open')
  })
})
