import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { router } from './router'
import AuthProvider from './auth/AuthProvider'
import ThemeColorMeta from '@/components/ThemeColorMeta'
import { Toaster } from '@/components/ui/sonner'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        <ThemeColorMeta />
        {/* Toast sopra la bottom navigation (h-16 + safe-area); mobileOffset:
            sonner usa variabili separate sotto i 600px, senza ignorerebbe offset */}
        <Toaster
          richColors
          position="bottom-center"
          offset={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
          mobileOffset={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
