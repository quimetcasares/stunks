import { expect, test } from '@playwright/test'

// Cuentas contra el Supabase local (`npm run db:iniciar`). El correo nunca sale: cae en Mailpit.
const SUPABASE = 'http://127.0.0.1:55321'
const MAILPIT = 'http://127.0.0.1:55324'

let prendido: Promise<boolean> | null = null
const supabaseLocal = () => {
  prendido ??= fetch(`${SUPABASE}/auth/v1/health`, { signal: AbortSignal.timeout(3000) }).then(
    () => true,
    () => false,
  )
  return prendido
}

async function linkDelCorreo(correo: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${correo}`)}`)
    const { messages } = (await r.json()) as { messages?: { ID: string }[] }
    if (messages?.length) {
      const m = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string }
      const link = m.Text.match(/https?:\/\/\S+\/verify\?\S+/)?.[0]
      if (link) return link
    }
    await new Promise((listo) => setTimeout(listo, 250))
  }
  throw new Error(`No llegó el correo a ${correo}`)
}

test.beforeEach(async () => {
  // En GitHub Actions el Supabase local siempre está; en la compu se salta si está apagado.
  if (!process.env.CI) test.skip(!(await supabaseLocal()), 'Supabase local apagado: npm run db:iniciar')
})

test('entra con el link del correo, elige apodo, sigue adentro al recargar y borra la cuenta', async ({ page }, info) => {
  const id = `${info.project.name}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const correo = `prueba-${id}@example.com`
  const apodo = `p_${id}`.slice(0, 20)

  await page.goto('/')
  await page.getByTestId('entrar').click()
  await expect(page.getByTestId('correo')).toBeVisible()
  // En el Supabase local Google está apagado (supabase/config.toml): la ventana no lo ofrece.
  await expect(page.getByTestId('google')).toHaveCount(0)
  await page.getByTestId('correo').fill(correo)
  await page.getByTestId('mandar-link').click()
  await expect(page.getByTestId('link-enviado')).toContainText(correo)

  await page.goto(await linkDelCorreo(correo))
  await expect(page.getByTestId('dialogo-cuenta')).toBeVisible()
  await page.getByTestId('apodo').fill(apodo)

  // Sin aceptar los dos avisos no se guarda nada.
  await page.getByTestId('guardar-apodo').click()
  expect(await page.getByTestId('acepto-privacidad').evaluate((el) => (el as HTMLInputElement).checkValidity())).toBe(false)
  await expect(page.getByTestId('cuenta')).not.toHaveText(apodo)

  await page.getByTestId('acepto-privacidad').check()
  await page.getByTestId('acepto-grabacion').check()
  await page.getByTestId('guardar-apodo').click()
  await expect(page.getByTestId('cuenta')).toHaveText(apodo)
  await page.keyboard.press('Escape')

  // Al volver ya no pide nada: apodo y avisos quedaron guardados.
  await page.reload()
  await expect(page.getByTestId('cuenta')).toHaveText(apodo)
  await expect(page.getByTestId('dialogo-cuenta')).not.toBeVisible()

  await page.getByTestId('cuenta').click()
  await page.getByTestId('borrar-cuenta').click()
  await page.getByTestId('confirmar-borrar').click()
  await expect(page.getByTestId('entrar')).toBeVisible()
})

test('un apodo inválido no se guarda y avisa por qué', async ({ page }, info) => {
  const correo = `invalido-${info.project.name}${Date.now().toString(36)}@example.com`
  await page.goto('/')
  await page.getByTestId('entrar').click()
  await page.getByTestId('correo').fill(correo)
  await page.getByTestId('mandar-link').click()
  await page.goto(await linkDelCorreo(correo))

  await page.getByTestId('apodo').fill('no vale')
  await page.getByTestId('guardar-apodo').click()
  // El navegador frena el envío por la regla del campo; el botón de la barra sigue sin apodo.
  expect(await page.getByTestId('apodo').evaluate((el) => (el as HTMLInputElement).checkValidity())).toBe(false)
  await expect(page.getByTestId('cuenta')).not.toHaveText('no vale')
})
