import { expect, test } from '@playwright/test'

// La versión publicada (npm run build): sin datos del NQ y sin llamadas a exchanges (docs/decisiones/0006).
const WEB = 'http://localhost:5200'
test.use({ baseURL: WEB })

test('la web abre un día del mercado de mentira sin pedir nada a otros sitios', async ({ page }) => {
  const fuera: string[] = []
  page.on('request', (r) => {
    const url = r.url()
    if (url.startsWith('http') && !url.startsWith(WEB)) fuera.push(url)
  })

  await page.goto('/')
  await expect(page.getByTestId('demo')).toBeVisible()
  await expect(page.locator('.p-barra input[type=date]')).not.toHaveValue('')
  await page.getByTestId('azar').click()
  await expect(page.getByTestId('dia')).toContainText('Sesión del')
  for (let i = 0; i < 3; i++) await page.getByTestId('paso').click()
  await page.getByTestId('comprar').click()
  await expect(page.getByTestId('posicion')).toBeVisible()

  expect(fuera).toEqual([])
})

test('la web no muestra la prueba técnica de los exchanges', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Acerca' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByTestId('download')).toHaveCount(0)
})

test('los avisos de privacidad y de grabación están publicados en español e inglés', async ({ page }) => {
  for (const [ruta, es, en] of [
    ['/privacidad', 'Aviso de privacidad', 'Privacy notice'],
    ['/grabacion', 'Aviso de grabación', 'Recording notice'],
  ]) {
    await page.goto(ruta)
    await expect(page.locator('#es h1')).toHaveText(es)
    await expect(page.locator('#en h1')).toHaveText(en)
    await expect(page.getByRole('link', { name: 'contacto@stunks.app' }).first()).toBeVisible()
  }
})

test('la práctica enlaza al aviso de privacidad', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Aviso de privacidad' }).first().click()
  await expect(page.locator('#es h1')).toHaveText('Aviso de privacidad')
})
