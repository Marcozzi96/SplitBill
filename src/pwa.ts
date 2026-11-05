import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

const UPDATE_INTERVAL_MS = 3 * 60 * 60 * 1000

export function registerAppServiceWorker() {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast.info('Nuova versione disponibile', {
        duration: Infinity,
        action: {
          label: 'Aggiorna',
          onClick: () => void updateServiceWorker(),
        },
      })
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      const checkForUpdate = () => {
        if (navigator.onLine && !registration.installing) {
          void registration.update()
        }
      }

      window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate()
        }
      })
    },
  })
}
