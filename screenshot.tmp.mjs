import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.emulateMedia({ colorScheme: 'dark' })
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForTimeout(2000)
await page.screenshot({ path: 'test-results/restyle/shot-boot.png' })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'test-results/restyle/shot-login-dark.png' })

const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page2.emulateMedia({ colorScheme: 'light' })
await page2.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page2.waitForTimeout(4000)
await page2.screenshot({ path: 'test-results/restyle/shot-login-light.png' })

await browser.close()
console.log('done')
process.exit(0)
