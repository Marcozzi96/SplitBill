import axios from 'axios'

export const TOKEN_KEY = 'splitbill_token'

// In dev il FE può essere aperto da altri device in LAN (es. smartphone sulla
// stessa wifi): il default segue l'host con cui è stata aperta la pagina, così
// le API puntano sempre alla macchina che serve il FE. Override con
// VITE_API_BASE_URL (.env, mai committato) — obbligatorio in produzione.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? `http://${window.location.hostname}:8080`,
})

// Il JWT va su ogni richiesta tranne /auth/** (endpoint pubblici).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && !config.url?.startsWith('/auth/')) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Su 401: token invalido/scaduto → logout forzato e redirect a /login.
// Su 429 (rate limit /auth/**): il messaggio viene gestito dalle pagine chiamanti.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)
