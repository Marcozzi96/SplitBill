import { render, screen } from '@testing-library/react'
import HomePage from './HomePage'

describe('HomePage', () => {
  it('mostra il titolo dell\'app', () => {
    render(<HomePage />)
    expect(screen.getByText('SplitBill')).toBeTruthy()
  })
})
