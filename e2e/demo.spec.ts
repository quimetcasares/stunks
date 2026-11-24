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
    // Ranked: solo "recibida"; si la página pintara un veredicto, lo inventaría ella.
    if (url.pathname.endsWith('/respuesta')) return json({ recibida: true, n })
    return json({ ok: true })
  })

  await page.goto('/real-or-stunks')
  await expect(page.getByTestId('rs-grafica')).toBeVisible()
  await expect(page.getByTestId('rs-prog')).toHaveText('Chart 1 of 10')
  // Ranked se abre primero y lo dice la página.
  await expect(page.getByTestId('rs-modo-reto')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('rs-modo-desc')).toContainText('10 charts. One attempt.')
  // Antes del mínimo los botones no se pueden tocar y no hay resultado a la vista.
  await expect(page.getByTestId('rs-real')).toBeDisabled()
  await expect(page.getByTestId('rs-resultado')).toHaveCount(0)
  await expect(page.getByTestId('rs-real')).toBeEnabled({ timeout: 5000 })

  await page.getByTestId('rs-real').click()
  await expect(page.getByTestId('rs-guardada')).toContainText('Answer locked in.')
  // En Ranked no se dice si acertó ni qué era: ni palabras de veredicto ni de la fuente.
  await expect(page.getByText(/Correct!|Wrong!|That was real ETH|That was simulated/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Wicks' }).click()
  await expect(page.getByTestId('rs-guardada')).toContainText('Thanks!')
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
    if (url.pathname.endsWith('/respuesta')) {
      if (n < 10) return json({ recibida: true, n })
      const revelacion = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, acerto: i < 7, era: i % 2 ? 'real' : 'stunks' }))
      return json({ recibida: true, n, revelacion })
    }
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
          tabla_hoy: [{ apodo: 'Ana', aciertos: 9, segundos: 80 }],
          tabla: [{ apodo: 'Ana', aciertos: 20, total: 30 }],
        },
        tu: { aciertos: 7, total: 10, apodo, lugar: null, reto: { aciertos: 7, mejor_que: 60, jugaron: 5, numero: 3 } },
      })
    return json({ ok: true })
  })
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/real-or-stunks')
  await expect(page.getByTestId('rs-marcador')).toContainText('Community accuracy: 48.6%')
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId('rs-prog')).toHaveText(`Chart ${i} of 10`)
    await expect(page.getByTestId('rs-real')).toBeEnabled()
    await page.getByTestId('rs-real').click()
    await page.getByTestId('rs-siguiente').click()
  }
  await expect(page.getByTestId('rs-puntaje')).toContainText('7 of 10')
  await expect(page.getByTestId('rs-revelacion')).toContainText('Chart 1: it was Stunks')
  await expect(page.getByTestId('rs-revelacion')).toContainText('Chart 2: it was real')
  await expect(page.getByTestId('rs-puntaje')).toContainText('better than 60%')
  await expect(page.getByTestId('rs-tabla')).toContainText('Ana')
  await expect(page.getByTestId('rs-tabla-hoy')).toContainText('9/10')
  await page.getByPlaceholder('Nickname').fill('Joa')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Saved as Joa')
  expect(apodo).toBe('Joa')
  await page.screenshot({ path: 'test-results/demo-final.png', fullPage: true })
})

test('antes de contestar, la página no muestra ni guarda la verdad aunque el servidor mande de más', async ({ page }) => {
  await page.route('**/functions/v1/demo/**', (route) => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h })
    if (new URL(route.request().url()).pathname.endsWith('/ronda'))
      return route.fulfill({
        contentType: 'application/json',
        headers: h,
        // El "de más" es una trampa: si la página lo pintara o lo guardara, la prueba lo vería.
        body: JSON.stringify({
          estado: 'ok',
          ronda: '00000000-0000-4000-8000-000000000001',
          modo: 'reto',
          n: 1,
          de: 10,
          espera_ms: 600000,
          velas: velas(),
          fuente: 'MARCA-DE-VERDAD',
        }),
      })
    return route.fulfill({ contentType: 'application/json', headers: h, body: '{}' })
  })
  await page.goto('/real-or-stunks')
  await expect(page.getByTestId('rs-grafica')).toBeVisible()
  expect(await page.content()).not.toContain('MARCA-DE-VERDAD')
  const guardado = await page.evaluate(
    () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie,
  )
  expect(guardado).not.toContain('MARCA-DE-VERDAD')
  // Solo se guarda el uuid anónimo del jugador.
  expect(Object.keys(JSON.parse(await page.evaluate(() => JSON.stringify({ ...localStorage }))))).toEqual(['stunks.demo.jugador'])
})

test('Free play: sin espera, no cuenta para la tabla y ofrece volver a Ranked', async ({ page }) => {
  let n = 0
  const pedidos: string[] = []
  await page.route('**/functions/v1/demo/**', async (route) => {
    const url = new URL(route.request().url())
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    const json = (cuerpo: unknown) => route.fulfill({ contentType: 'application/json', headers: h, body: JSON.stringify(cuerpo) })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h })
    pedidos.push(url.pathname.split('/').pop() ?? '')
    if (url.pathname.endsWith('/ronda')) {
      const modo = url.searchParams.get('modo')
      n++
      return json({
        estado: 'ok',
        ronda: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
        modo,
        n: ((n - 2) % 10) + 1,
        de: 10,
        espera_ms: modo === 'reto' ? 5000 : 0,
        velas: velas(),
      })
    }
    if (url.pathname.endsWith('/respuesta')) return json({ acerto: true, era: 'real' })
    return json({ ok: true })
  })
  await page.goto('/real-or-stunks')
  // Ranked trae 5 s de espera: los botones están bloqueados.
  await expect(page.getByTestId('rs-real')).toBeDisabled()
  await page.getByTestId('rs-modo-libre').click()
  await expect(page.getByTestId('rs-modo-desc')).toContainText('No ranking')
  await expect(page.getByTestId('rs-real')).toBeEnabled({ timeout: 1500 })
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId('rs-prog')).toHaveText(`Chart ${i} of 10`)
    await page.getByTestId('rs-real').click()
    await page.getByTestId('rs-siguiente').click()
  }
  await expect(page.getByTestId('rs-puntaje')).toContainText('10 of 10')
  await expect(page.getByTestId('rs-free-nota')).toBeVisible()
  await expect(page.getByTestId('rs-tabla')).toHaveCount(0)
  await expect(page.getByTestId('rs-ir-ranked')).toBeVisible()
  expect(pedidos).not.toContain('agregado-libre')
})

test('la liga trae sus etiquetas og: y de Twitter en el HTML estático (los robots no ejecutan JavaScript)', async ({
  request,
}) => {
  const html = await (await request.get('/real-or-stunks')).text()
  for (const esperado of [
    '<title>Can you tell a real market from a simulated one? | Real or Stunks?</title>',
    'property="og:title" content="Can you tell a real market from a simulated one? | Real or Stunks?"',
    'property="og:description"',
    'property="og:url" content="https://stunks.app/real-or-stunks"',
    'property="og:image" content="https://stunks.app/og-real-or-stunks.png"',
    'property="og:image:width" content="1200"',
    'name="twitter:card" content="summary_large_image"',
    'name="twitter:image" content="https://stunks.app/og-real-or-stunks.png"',
    'rel="canonical" href="https://stunks.app/real-or-stunks"',
  ])
    expect(html).toContain(esperado)
  // Sin spoilers: ninguna etiqueta dice cuál es la respuesta ni nombra la fuente.
  expect(html).not.toMatch(/dydx|hyperliquid|ethereal|ETR/i)
  // La portada de Stunks no se contagia de las etiquetas de la demo.
  const portada = await (await request.get('/')).text()
  expect(portada).not.toContain('og:title')
  // La imagen existe, es PNG y mide lo que dicen las etiquetas.
  const img = await request.get('/og-real-or-stunks.png')
  expect(img.status()).toBe(200)
  expect(img.headers()['content-type']).toContain('image/png')
  const bytes = await img.body()
  expect(bytes.subarray(1, 4).toString()).toBe('PNG')
  expect(bytes.readUInt32BE(16)).toBe(1200)
  expect(bytes.readUInt32BE(20)).toBe(630)
})

test('si la huella de IP ya llegó al tope de corridas de Ranked, lo dice y ofrece Free play', async ({ page }) => {
  await page.route('**/functions/v1/demo/**', async (route) => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h })
    return route.fulfill({ contentType: 'application/json', headers: h, body: JSON.stringify({ estado: 'tope' }) })
  })
  await page.goto('/real-or-stunks')
  await expect(page.getByText('Too many Ranked runs have started from your network today')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try Free Play' })).toBeVisible()
})
