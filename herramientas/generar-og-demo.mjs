// Genera public/og-real-or-stunks.png (1200 x 630), la imagen que se ve al pegar la liga de la demo en Reddit, X, etc.
// Sin spoilers: las velas salen de un camino al azar inventado aquí (semilla fija), NO de ninguna ventana del pool, y la imagen
// no dice cuál de los dos botones es la respuesta.
// Uso: node herramientas/generar-og-demo.mjs   (necesita Chromium de Playwright: npx playwright install chromium)
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

function azar(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const r = azar(20261124)
const N = 38
const velas = []
let p = 0
for (let i = 0; i < N; i++) {
  const o = p
  p += (r() - 0.47) * 1.1
  const c = p
  velas.push({ o, c, h: Math.max(o, c) + r() * 0.5, l: Math.min(o, c) - r() * 0.5, v: 0.3 + r() })
}
const min = Math.min(...velas.map((v) => v.l))
const max = Math.max(...velas.map((v) => v.h))
const X0 = 70
const W = 1060
const Y0 = 215
const H = 260
const y = (x) => Y0 + H - ((x - min) / (max - min)) * H
const paso = W / N
const cuerpos = velas
  .map((v, i) => {
    const x = X0 + i * paso + paso / 2
    const sube = v.c >= v.o
    const col = sube ? '#089981' : '#f23645'
    const top = y(Math.max(v.o, v.c))
    const alto = Math.max(3, Math.abs(y(v.o) - y(v.c)))
    return `<line x1="${x}" x2="${x}" y1="${y(v.h)}" y2="${y(v.l)}" stroke="${col}" stroke-width="3"/><rect x="${x - paso * 0.3}" y="${top}" width="${paso * 0.6}" height="${alto}" fill="${col}"/><rect x="${x - paso * 0.3}" y="${Y0 + H + 30 - v.v * 26}" width="${paso * 0.6}" height="${v.v * 26}" fill="${col}" opacity="0.35"/>`
  })
  .join('')

const html = `<!doctype html><html><body style="margin:0;background:#131722">
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="'Trebuchet MS', Arial, sans-serif">
  <rect width="1200" height="630" fill="#131722"/>
  <rect x="40" y="190" width="1120" height="330" rx="14" fill="#161b28" stroke="#2a2e39" stroke-width="2"/>
  ${cuerpos}
  <text x="70" y="98" font-size="74" font-weight="800" fill="#f0f3fa">Real or Stunks?</text>
  <text x="72" y="148" font-size="31" fill="#b2b5be">Think you can spot a fake market?</text>
  <rect x="40" y="548" width="540" height="62" rx="14" fill="#1e222d" stroke="#089981" stroke-width="4"/>
  <text x="310" y="591" font-size="34" font-weight="800" fill="#f0f3fa" text-anchor="middle">Real</text>
  <rect x="620" y="548" width="540" height="62" rx="14" fill="#1e222d" stroke="#ffc531" stroke-width="4"/>
  <text x="890" y="591" font-size="34" font-weight="800" fill="#f0f3fa" text-anchor="middle">Stunks</text>
  <text x="1160" y="60" font-size="30" font-weight="800" fill="#ffc531" text-anchor="end">stunks.app</text>
  <text x="1160" y="100" font-size="24" fill="#787b86" text-anchor="end">10 charts · One attempt · No sign-up</text>
</svg></body></html>`

const nav = await chromium.launch()
const pag = await nav.newPage({ viewport: { width: 1200, height: 630 } })
await pag.setContent(html)
writeFileSync(new URL('../public/og-real-or-stunks.png', import.meta.url), await pag.screenshot({ type: 'png' }))
await nav.close()
console.log('public/og-real-or-stunks.png listo')
