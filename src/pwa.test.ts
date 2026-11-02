import { registerAppServiceWorker } from './pwa'
import { registerSW } from 'virtual:pwa-register'

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }))

type RegisterOptions = Parameters<typeof registerSW>[0]

function getRegistrationOptions(): NonNullable<RegisterOptions> {
  return vi.mocked(registerSW).mock.calls[0][0]!
}

function createRegistration(installing: ServiceWorker | null = null) {
  return {
    installing,
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServiceWorkerRegistration & {
    update: ReturnType<typeof vi.fn>
  }
}

describe('registerAppServiceWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(registerSW).mockClear()
    registerAppServiceWorker()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('registers the service worker immediately', () => {
    expect(getRegistrationOptions().immediate).toBe(true)
  })

  it('checks for updates every 3 hours', () => {
    const registration = createRegistration()
    getRegistrationOptions().onRegisteredSW!('/sw.js', registration)

    vi.advanceTimersByTime(3 * 60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3 * 60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('checks for updates when the app becomes visible', () => {
    const registration = createRegistration()
    getRegistrationOptions().onRegisteredSW!('/sw.js', registration)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('skips checks while offline or another update is installing', () => {
    const registration = createRegistration({} as ServiceWorker)
    getRegistrationOptions().onRegisteredSW!('/sw.js', registration)

    vi.advanceTimersByTime(3 * 60 * 60 * 1000)
    expect(registration.update).not.toHaveBeenCalled()

    const onlineRegistration = createRegistration()
    getRegistrationOptions().onRegisteredSW!('/sw.js', onlineRegistration)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    vi.advanceTimersByTime(3 * 60 * 60 * 1000)
    expect(onlineRegistration.update).not.toHaveBeenCalled()
  })
})
