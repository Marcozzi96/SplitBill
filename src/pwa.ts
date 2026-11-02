import { registerSW } from 'virtual:pwa-register'

const UPDATE_INTERVAL_MS = 3 * 60 * 60 * 1000

export function registerAppServiceWorker() {
  registerSW({
    immediate: true,
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
