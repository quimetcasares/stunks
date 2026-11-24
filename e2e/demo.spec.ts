import { expect, test } from '@playwright/test'

// La demo "Real or Stunks?" contra un servidor de mentira (la función demo real no corre en local). Versión publicada.
test.use({ baseURL: 'http://localhost:5200' })

const velas = () => {
  const o: number[] = []
  const h: number[] = []
  const l: number[] = []
  const c: number[] = []
  const v: number[] = []
  let p = 0
  for (let i = 0; i < 60; i++) {
    o.push(p)
    p += Math.sin(i) * 0.05
    c.push(p)
    h.push(Math.max(o[i], p) + 0.02)
    l.push(Math.min(o[i], p) - 0.02)
    v.push(1 + (i % 3) * 0.1)
  }
  return { o, h, l, c, v }
}

test('se juega el reto: primera gráfica sin pantalla previa, botones tras el mínimo, resultado y pista', async ({ page }) => {
  let n = 0
  const vistos: string[] = []
  await page.route('**/functions/v1/demo/**', async (route) => {
    const url = new URL(route.request().url())
    const json = (cuerpo: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(cuerpo),
      })
    vistos.push(`${route.request().method()} ${url.pathname.split('/').pop()}`)
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
    if (url.pathname.endsWith('/ronda')) {
      n++
      return json({
        estado: 'ok',
        ronda: `00000000-0000-4000-8000-00000000000${n % 10}`,
        modo: 'reto',
        n,
        de: 10,
        espera_ms: 1200,
        velas: velas(),
      })
    }
    if (url.pathname.endsWith('/respuesta')) return json({ acerto: n % 2 === 1, era: 'real' })
    return json({ ok: true })
  })

  await page.goto('/real-or-stunks')
  await expect(page.getByTestId('rs-grafica')).toBeVisible()
  await expect(page.getByTestId('rs-prog')).toHaveText('Chart 1 of 10')
  // Antes del mínimo los botones no se pueden tocar y no hay resultado a la vista.
  await expect(page.getByTestId('rs-real')).toBeDisabled()
  await expect(page.getByTestId('rs-resultado')).toHaveCount(0)
  await expect(page.getByTestId('rs-real')).toBeEnabled({ timeout: 5000 })

  await page.getByTestId('rs-real').click()
  await expect(page.getByTestId('rs-resultado')).toContainText('Correct!')
  await page.getByRole('button', { name: 'Wicks' }).click()
  await expect(page.getByTestId('rs-resultado')).toContainText('Thanks!')
  await page.getByTestId('rs-siguiente').click()
  await expect(page.getByTestId('rs-prog')).toHaveText('Chart 2 of 10')
  expect(vistos).toContain('POST pista')
})

test('la demo sin servidor muestra un error y deja reintentar', async ({ page }) => {
  await page.route('**/functions/v1/demo/**', (route) => route.abort())
  await page.goto('/real-or-stunks')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('en cel los dos botones son grandes y están dentro de la pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await page.route('**/functions/v1/demo/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        estado: 'ok',
        ronda: '00000000-0000-4000-8000-000000000001',
        modo: 'reto',
        n: 1,
        de: 10,
        espera_ms: 0,
        velas: velas(),
      }),
    }),
  )
  await page.goto('/real-or-stunks')
  const b = await page.getByTestId('rs-real').boundingBox()
  expect(b?.height).toBeGreaterThanOrEqual(64)
  expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual(780)
  const g = await page.getByTestId('rs-grafica').boundingBox()
  expect((g?.y ?? 0) + (g?.height ?? 0)).toBeLessThanOrEqual(b?.y ?? 0)
  await page.screenshot({ path: 'test-results/demo-cel.png' })
})
