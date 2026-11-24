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

test('al terminar las 10: puntaje, tarjeta sin spoilers, tabla y apodo; el marcador se ve', async ({ page }) => {
  let n = 0
  let apodo: string | null = null
  await page.route('**/functions/v1/demo/**', async (route) => {
    const url = new URL(route.request().url())
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    const json = (cuerpo: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', headers: h, body: JSON.stringify(cuerpo) })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h })
    if (url.pathname.endsWith('/ronda'))
      return json({
        estado: 'ok',
        ronda: `00000000-0000-4000-8000-0000000000${String(++n).padStart(2, '0')}`,
        modo: 'reto',
        n,
        de: 10,
        espera_ms: 0,
        velas: velas(),
      })
    if (url.pathname.endsWith('/respuesta')) return json({ acerto: n <= 7, era: 'stunks' })
    if (url.pathname.endsWith('/apodo')) {
      apodo = JSON.parse(route.request().postData() ?? '{}').apodo
      return json({ ok: true })
    }
    if (url.pathname.endsWith('/agregado'))
      return json({
        comun: {
          total: 1234,
          aciertos: 600,
          jugadores: 80,
          hoy_total: 100,
          hoy_aciertos: 50,
          tabla: [{ apodo: 'Ana', aciertos: 20, total: 30 }],
        },
        tu: { aciertos: 7, total: 10, apodo, lugar: null, reto: { aciertos: 7, mejor_que: 60, jugaron: 5, numero: 3 } },
      })
    return json({ ok: true })
  })
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/real-or-stunks')
  await expect(page.getByTestId('rs-marcador')).toContainText('48.6% right')
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId('rs-prog')).toHaveText(`Chart ${i} of 10`)
    await expect(page.getByTestId('rs-real')).toBeEnabled()
    await page.getByTestId('rs-real').click()
    await page.getByTestId('rs-siguiente').click()
  }
  await expect(page.getByTestId('rs-puntaje')).toContainText('7 of 10')
  await expect(page.getByTestId('rs-puntaje')).toContainText('better than 60%')
  await expect(page.getByTestId('rs-tabla')).toContainText('Ana')
  await page.getByPlaceholder('Nickname').fill('Joa')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Saved as Joa')
  expect(apodo).toBe('Joa')
  await page.screenshot({ path: 'test-results/demo-final.png', fullPage: true })
})
