import { defineConfig, devices } from '@playwright/test'

// Pruebas de punta a punta con un mercado de mentira (nunca con datos del CME).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:5199', trace: 'retain-on-failure' },
  projects: [
    { name: 'compu', use: { ...devices['Desktop Chrome'] } },
    { name: 'cel', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command:
      'node --experimental-strip-types herramientas/generar-datos-falsos.ts e2e/.datos && npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    env: { STUNKS_DATOS: 'e2e/.datos', STUNKS_E2E: '1' },
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
})
