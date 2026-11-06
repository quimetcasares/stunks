// Arma un "mercado de mentira" en el formato de los datos del NQ, para las pruebas de punta a punta.
// Uso: node --experimental-strip-types herramientas/generar-datos-falsos.ts <carpeta de salida>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { codificar, mercadoDeMentira } from '../src/practica/sintetico.ts'

const salida = process.argv[2] ?? 'e2e/.datos'
const carpeta = join(salida, 'nq', 'm')
mkdirSync(carpeta, { recursive: true })

const meses: { m: string; dias: number; velas: number; todo: number; ny: number; kb: number }[] = []
for (const { m, dias } of mercadoDeMentira()) {
  const gz = gzipSync(codificar(dias))
  writeFileSync(join(carpeta, `${m}.bin.gz`), gz)
  const velas = dias.reduce((a, D) => a + D.velas.length, 0)
  const habiles = dias.filter((D) => !D.pad).length
  meses.push({ m, dias: habiles, velas, todo: velas, ny: velas, kb: Math.round(gz.length / 1024) })
}
writeFileSync(join(salida, 'nq', 'manifest.json'), JSON.stringify({ version: 1, tick: 0.25, meses }))
console.log(`mercado de mentira listo en ${salida}: ${meses.reduce((a, x) => a + x.dias, 0)} días`)
