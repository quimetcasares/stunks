// Arma un "mercado de mentira" en el formato de los datos del NQ, para las pruebas de punta a punta.
// Uso: node --experimental-strip-types herramientas/generar-datos-falsos.ts <carpeta de salida>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { codificar, type DiaFalso, diaFalso } from '../src/practica/sintetico.ts'

const salida = process.argv[2] ?? 'e2e/.datos'
const carpeta = join(salida, 'nq', 'm')
mkdirSync(carpeta, { recursive: true })

// días hábiles de enero y febrero de 2001 (fechas de mentira a propósito)
const dias: DiaFalso[] = []
let precio = 60000 // en ticks: 15,000 puntos
let semilla = 7
for (let mes = 1; mes <= 2; mes++) {
  for (let d = 1; d <= 28; d++) {
    const fecha = new Date(Date.UTC(2001, mes - 1, d))
    const dow = fecha.getUTCDay()
    if (dow === 0 || dow === 6) continue
    const t0 = Date.UTC(2001, mes - 1, d - 1, 23, 0, 0) / 1000 // 18:00 ET del día anterior
    const D = diaFalso(2001_00_00 + mes * 100 + d, t0, precio, 600, semilla++)
    precio = D.velas[D.velas.length - 1].c
    dias.push(D)
  }
}

const meses: { m: string; dias: number; velas: number; todo: number; ny: number; kb: number }[] = []
for (const mes of [1, 2]) {
  const delMes = dias.filter((D) => Math.floor(D.fecha / 100) % 100 === mes)
  const i0 = dias.indexOf(delMes[0])
  const lista = i0 > 0 ? [{ ...dias[i0 - 1], pad: true }, ...delMes] : delMes
  const gz = gzipSync(codificar(lista))
  const m = `2001-${String(mes).padStart(2, '0')}`
  writeFileSync(join(carpeta, `${m}.bin.gz`), gz)
  const velas = lista.reduce((a, D) => a + D.velas.length, 0)
  meses.push({ m, dias: delMes.length, velas, todo: velas, ny: velas, kb: Math.round(gz.length / 1024) })
}
writeFileSync(join(salida, 'nq', 'manifest.json'), JSON.stringify({ version: 1, tick: 0.25, meses }))
console.log(`mercado de mentira listo en ${salida}: ${dias.length} días`)
