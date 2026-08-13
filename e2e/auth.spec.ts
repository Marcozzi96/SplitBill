import { test, expect } from '@playwright/test'

// Smoke test dell'app: routing pubblico e route guard, senza backend.
test.describe('auth', () => {
  test('la pagina di login mostra il form di accesso', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Accedi a SplitBill')).toBeVisible()
    await expect(page.getByLabel('Username o email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible()
  })

  test('le pagine protette reindirizzano a /login senza token', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('i link tra login e registrazione funzionano', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Registrati' }).click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByText('Crea il tuo account')).toBeVisible()
  })
})
