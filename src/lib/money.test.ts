import {
  centsToAmountInput,
  evaluateMoneyExpression,
  parseAmountToCents,
  resolveAmountToCents,
} from './money'

describe('parseAmountToCents', () => {
  it('accetta importi con virgola o punto', () => {
    expect(parseAmountToCents('12,5')).toBe(1250)
    expect(parseAmountToCents('12.50')).toBe(1250)
    expect(parseAmountToCents('7')).toBe(700)
  })

  it('rifiuta espressioni e formati non validi', () => {
    expect(parseAmountToCents('1+2')).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
    expect(parseAmountToCents('1.234')).toBeNull()
  })
})

describe('evaluateMoneyExpression', () => {
  it('valuta somme e sottrazioni', () => {
    expect(evaluateMoneyExpression('12,50 + 3')).toBe(1550)
    expect(evaluateMoneyExpression('10-2,50')).toBe(750)
  })

  it('rispetta la precedenza di × e ÷', () => {
    expect(evaluateMoneyExpression('2 + 3 × 4')).toBe(1400)
    expect(evaluateMoneyExpression('10 ÷ 4')).toBe(250)
    expect(evaluateMoneyExpression('10 × 2 + 5')).toBe(2500)
  })

  it('accetta gli operatori ascii equivalenti', () => {
    expect(evaluateMoneyExpression('3*4')).toBe(1200)
    expect(evaluateMoneyExpression('10/4')).toBe(250)
  })

  it('accetta spazi ovunque e arrotonda ai centesimi', () => {
    expect(evaluateMoneyExpression('  10  ÷  3  ')).toBe(333)
    expect(evaluateMoneyExpression('1 ÷ 3 × 3')).toBe(100)
  })

  it('supporta le parentesi', () => {
    expect(evaluateMoneyExpression('(12,50 + 3) × 2')).toBe(3100)
    expect(evaluateMoneyExpression('2 × (3 + 4)')).toBe(1400)
    expect(evaluateMoneyExpression('(10)')).toBe(1000)
  })

  it('rifiuta parentesi sbilanciate o vuote', () => {
    expect(evaluateMoneyExpression('(2 + 3')).toBeNull()
    expect(evaluateMoneyExpression('2 + 3)')).toBeNull()
    expect(evaluateMoneyExpression('() + 1')).toBeNull()
  })

  it('rifiuta espressioni malformate', () => {
    expect(evaluateMoneyExpression('')).toBeNull()
    expect(evaluateMoneyExpression('1 +')).toBeNull()
    expect(evaluateMoneyExpression('+ 1')).toBeNull()
    expect(evaluateMoneyExpression('1 ++ 2')).toBeNull()
    expect(evaluateMoneyExpression('1,2,3 + 1')).toBeNull()
    expect(evaluateMoneyExpression('10')).toBeNull() // non è un'espressione
  })

  it('rifiuta divisione per zero e risultati negativi', () => {
    expect(evaluateMoneyExpression('10 ÷ 0')).toBeNull()
    expect(evaluateMoneyExpression('3 − 5')).toBeNull()
  })
})

describe('resolveAmountToCents', () => {
  it('accetta sia importi semplici sia espressioni', () => {
    expect(resolveAmountToCents('12,50')).toBe(1250)
    expect(resolveAmountToCents('12,50 + 3')).toBe(1550)
    expect(resolveAmountToCents('non valido')).toBeNull()
  })
})

describe('centsToAmountInput', () => {
  it('formatta i centesimi come testo da input', () => {
    expect(centsToAmountInput(1550)).toBe('15,50')
    expect(centsToAmountInput(700)).toBe('7,00')
  })
})
