import { useEffect } from 'react'
import { useTheme } from 'next-themes'

// theme-color della status bar segue il tema attivo (chiaro/scuro).
const THEME_COLORS = { light: '#eef2f8', dark: '#0a1020' } as const

export default function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', THEME_COLORS[resolvedTheme === 'dark' ? 'dark' : 'light'])
  }, [resolvedTheme])
  return null
}
