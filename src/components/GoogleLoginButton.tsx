import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { useGoogleLogin } from '@/api/hooks/auth'
import { getApiErrorMessage } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'

// Tipi minimi del client Google Identity Services (nessuna dipendenza npm extra).
interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const GOOGLE_SCRIPT_ID = 'google-gsi-client'

// Carica lo script GSI una sola volta (condiviso tra LoginPage e RegisterPage).
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve()
      return
    }
    const existing = document.getElementById(GOOGLE_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Errore caricamento script Google')))
      return
    }
    const script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Errore caricamento script Google'))
    document.head.appendChild(script)
  })
}

interface GoogleLoginButtonProps {
  onError: (message: string) => void
}

// Bottone ufficiale "Continua con Google": feature-flag via VITE_GOOGLE_CLIENT_ID.
export default function GoogleLoginButton({ onError }: GoogleLoginButtonProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const googleLogin = useGoogleLogin()

  // Stessa destinazione del login classico (vedi LoginPage).
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  // La callback viene passata una sola volta a initialize: via ref usa sempre i valori correnti.
  const onCredentialRef = useRef<(response: GoogleCredentialResponse) => void>(() => {})
  onCredentialRef.current = (response) => {
    if (!response.credential) {
      onError('Autenticazione Google non riuscita')
      return
    }
    googleLogin.mutate(
      { idToken: response.credential },
      {
        onSuccess: (auth) => {
          login(auth)
          navigate(from, { replace: true })
        },
        onError: (err) => onError(getApiErrorMessage(err)),
      },
    )
  }

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        const gis = window.google?.accounts?.id
        if (cancelled || !gis || !containerRef.current) return
        gis.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response),
        })
        // Pulizia difensiva: renderButton non deve accodare un secondo bottone.
        containerRef.current.innerHTML = ''
        gis.renderButton(containerRef.current, {
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          // jsdom/non-layout: clientWidth 0 → fallback a una larghezza ragionevole.
          width: containerRef.current.clientWidth || 320,
        })
      })
      .catch(() => onError('Impossibile caricare il login con Google'))
    return () => {
      cancelled = true
    }
  }, [clientId, resolvedTheme, onError])

  if (!clientId) return null

  return <div ref={containerRef} className="gsi-button-container flex justify-center" />
}
