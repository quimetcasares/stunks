// Prueba de la fase 4: el motor de Stunks contra las 3,000 jugadas del motor del juego.
// Uso: node --experimental-strip-types herramientas/probar-motor.ts <carpeta con AAAA-MM.bin.gz> <prueba_motor_js.json>
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { type Dia, decodificar } from '../src/practica/datos.ts'
import { resolver } from '../src/practica/motor.ts'

const [carpeta, archivoJugadas] = process.argv.slice(2)
const jugadas = JSON.parse(readFileSync(archivoJugadas, 'utf8')) as {
  fecha: number
  e: number
  lado: 1 | -1
  stop: number
  obj: number
  tipo: string
  js: number
  entrada: number
  salida: number
  neto: number
}[]

const meses = new Map<string, Dia[]>()
function dia(fecha: number): Dia | null {
  const s = String(fecha)
  const m = `${s.slice(0, 4)}-${s.slice(4, 6)}`
  if (!meses.has(m)) {
    const f = join(carpeta, `${m}.bin.gz`)
    if (!existsSync(f)) return null
    const u8 = gunzipSync(readFileSync(f))
    meses.set(m, decodificar(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)))
  }
  return meses.get(m)!.find((d) => d.fecha === fecha && !d.pad) ?? null
}

let probadas = 0
let distintas = 0
let sinDatos = 0
let maxDif = 0
for (const x of jugadas) {
  const D = dia(x.fecha)
  if (!D) {
    sinDatos++
    continue
  }
  const r = resolver(D, x.e, x.lado, x.stop, x.obj, 1)
  probadas++
  const dif = Math.abs(r.neto - x.neto)
  maxDif = Math.max(maxDif, dif)
  if (r.tipo !== x.tipo || r.js !== x.js || dif > 1e-9 || Math.abs(r.entrada - x.entrada) > 1e-9) {
    distintas++
    if (distintas <= 5) console.log('distinta', x, { tipo: r.tipo, js: r.js, entrada: r.entrada, neto: r.neto })
  }
}
console.log(
  `jugadas ${jugadas.length} · probadas ${probadas} · distintas ${distintas} · sin datos ${sinDatos} · máx diferencia ${maxDif}`,
)
process.exit(distintas === 0 && probadas > 0 ? 0 : 1)
