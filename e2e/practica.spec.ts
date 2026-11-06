import { expect, test } from '@playwright/test'

test('abrir un día al azar, avanzar, comprar y cerrar', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.p-barra input[type=date]')).not.toHaveValue('')
  await page.getByTestId('azar').click()
  await expect(page.getByTestId('dia')).toContainText('Sesión del')

  for (let i = 0; i < 5; i++) await page.getByTestId('paso').click()
  await page.getByTestId('comprar').click()
  await expect(page.getByTestId('posicion')).toBeVisible()

  for (let i = 0; i < 3; i++) await page.getByTestId('paso').click()
  const cerrar = page.getByTestId('cerrar')
  if (await cerrar.isVisible()) await cerrar.click()

  const filas = page.getByTestId('jugadas').locator('tbody tr')
  await expect(filas).toHaveCount(1)
  await expect(filas.first()).toContainText('Compra')
})

test('el replay avanza solo con play', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.p-barra input[type=date]')).not.toHaveValue('')
  await page.getByRole('button', { name: 'Abrir día' }).click()
  await expect(page.getByTestId('dia')).toBeVisible()
  await page.getByRole('button', { name: '100x' }).click()
  await page.getByTestId('play').click()
  await expect(page.locator('.p-info')).not.toContainText('vela 0 de', { timeout: 15_000 })
})

test('a ciegas esconde la fecha hasta que la revelas', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.p-barra input[type=date]')).not.toHaveValue('')
  await page.getByLabel('A ciegas').check()
  await page.getByTestId('azar').click()
  await expect(page.getByTestId('dia')).toHaveText('Día oculto')
  await page.getByRole('button', { name: 'Revelar día' }).click()
  await expect(page.getByTestId('dia')).toContainText('2001')
})

test('la pestaña Acerca muestra la prueba técnica', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Acerca' }).click()
  await expect(page.getByTestId('download')).toBeVisible()
})
