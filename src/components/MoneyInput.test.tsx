import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MoneyInput } from './MoneyInput'

function TestHost({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <MoneyInput aria-label="Importo" value={value} onChange={setValue} />
}

function input(): HTMLInputElement {
  return screen.getByLabelText('Importo') as HTMLInputElement
}

describe('MoneyInput', () => {
  it('al focus mostra il tastierino e i tasti inseriscono le cifre', () => {
    render(<TestHost />)

    expect(screen.queryByRole('button', { name: '7' })).toBeNull()
    fireEvent.focus(input())
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Virgola' }))
    fireEvent.click(screen.getByRole('button', { name: '5' }))

    expect(input().value).toBe('12,5')
  })

  it('il tasto cancella rimuove l’ultimo carattere', () => {
    render(<TestHost initial="12,5" />)

    fireEvent.focus(input())
    fireEvent.click(screen.getByRole('button', { name: 'Cancella' }))

    expect(input().value).toBe('12,')
  })

  it('"=" risolve l’espressione nel campo', () => {
    render(<TestHost />)

    fireEvent.focus(input())
    fireEvent.change(input(), { target: { value: '12,50 + 3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Uguale' }))

    expect(input().value).toBe('15,50')
  })

  it('mostra l’anteprima del risultato mentre si digita un’espressione', () => {
    render(<TestHost />)

    fireEvent.change(input(), { target: { value: '2 + 3 × 4' } })

    const preview = screen.getByText((_, el) =>
      el?.tagName === 'P' && (el.textContent ?? '').startsWith('='),
    )
    expect(preview.textContent).toContain('14,00')
  })

  it('il blur risolve l’espressione e chiude il tastierino', () => {
    render(<TestHost />)

    fireEvent.focus(input())
    fireEvent.change(input(), { target: { value: '10 ÷ 4' } })
    fireEvent.blur(input())

    expect(input().value).toBe('2,50')
    expect(screen.queryByRole('button', { name: 'Uguale' })).toBeNull()
  })

  it('"Fine" chiude il tastierino', () => {
    render(<TestHost />)

    fireEvent.focus(input())
    fireEvent.click(screen.getByRole('button', { name: 'Fine' }))

    expect(screen.queryByRole('button', { name: 'Uguale' })).toBeNull()
  })

  it('un click sul campo già in focus riapre il tastierino', () => {
    render(<TestHost />)

    fireEvent.focus(input())
    fireEvent.click(screen.getByRole('button', { name: 'Fine' }))
    expect(screen.queryByRole('button', { name: 'Uguale' })).toBeNull()

    fireEvent.click(input())
    expect(screen.getByRole('button', { name: 'Uguale' })).toBeTruthy()
  })

  it('il tastierino include le parentesi e le digita nel campo', () => {
    render(<TestHost />)

    fireEvent.focus(input())
    fireEvent.click(screen.getByRole('button', { name: 'Parentesi aperta' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Più' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Parentesi chiusa' }))

    expect(input().value).toBe('(2+3)')
  })
})
