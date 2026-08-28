import { formatBytes, formatBytesPerSecond } from './bytes'

describe('formatBytes', () => {
  it('formatta zero, negativi e NaN come 0 B', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })

  it('formatta i byte senza decimali', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formatta i KB con al massimo un decimale', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1,5 KB')
  })

  it('formatta MB e GB', () => {
    expect(formatBytes(1024 ** 2)).toBe('1 MB')
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2,5 GB')
  })

  it('satura sui TB per valori molto grandi', () => {
    expect(formatBytes(3 * 1024 ** 4)).toBe('3 TB')
  })
})

describe('formatBytesPerSecond', () => {
  it('aggiunge il suffisso /s', () => {
    expect(formatBytesPerSecond(2048)).toBe('2 KB/s')
  })
})
