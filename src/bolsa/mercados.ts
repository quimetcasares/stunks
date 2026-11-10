// SPDX-License-Identifier: MIT
// Ficha de contrato de los 12 mercados de la bolsa de Stunks: lo que la app necesita para mostrar precios
// y calcular resultados. Cómo se mueve cada mercado no va aquí; eso es del generador (decisión 0010).
import { HISTORICO_DESDE, type Horario, type Sesion, sesion } from './calendario.ts'

export type Clave = 'MQ' | 'SP' | 'DJ' | 'FL' | 'WT' | 'FG' | 'EW' | 'BTY' | 'ETR' | 'SLMI' | 'FIDO' | 'CHUPA'

export type Tipo = 'indice' | 'materia' | 'divisa' | 'cripto'

export interface Ficha {
  // Id interno fijo, de B01 a B12. La semilla y los archivos usan este id, no la clave: el nombre y la clave se
  // pueden cambiar sin que cambie ningún día.
  id: string
  clave: Clave
  nombre: string // el mismo en todos los idiomas
  tipo: Tipo
  horario: Horario
  tick: number // movimiento mínimo del precio
  decimales: number // decimales con que se muestra el precio
  valorPunto: number // dólares por punto de precio, por contrato (en cripto, por unidad)
  micro: { clave: string; valorPunto: number } | null // mismas operaciones, otro valor por punto
  unidad: number // lo que vale q = 1: un contrato en futuros, la fracción mínima en cripto
  desde: number // primera sesión, aaaammdd
}

const futuro = (
  id: string,
  clave: Clave,
  nombre: string,
  tipo: Tipo,
  tick: number,
  decimales: number,
  valorPunto: number,
  micro: Ficha['micro'],
): Ficha => ({
  id,
  clave,
  nombre,
  tipo,
  horario: 'futuros',
  tick,
  decimales,
  valorPunto,
  micro,
  unidad: 1,
  desde: HISTORICO_DESDE,
})

const cripto = (
  id: string,
  clave: Clave,
  nombre: string,
  tick: number,
  decimales: number,
  unidad: number,
  desde = HISTORICO_DESDE,
): Ficha => ({
  id,
  clave,
  nombre,
  tipo: 'cripto',
  horario: 'cripto',
  tick,
  decimales,
  valorPunto: 1,
  micro: null,
  unidad,
  desde,
})

/** Los 12 mercados, en el orden en que se muestran. */
export const MERCADOS: readonly Ficha[] = [
  futuro('B01', 'MQ', 'Madsaq 100', 'indice', 0.25, 2, 20, { clave: 'MMQ', valorPunto: 2 }),
  futuro('B02', 'SP', "Substandard & Poor's 500", 'indice', 0.25, 2, 50, { clave: 'MSP', valorPunto: 5 }),
  futuro('B03', 'DJ', 'Down Jones 30', 'indice', 1, 0, 5, { clave: 'MDJ', valorPunto: 0.5 }),
  futuro('B04', 'FL', 'Flea 2000', 'indice', 0.1, 1, 50, { clave: 'MFL', valorPunto: 5 }),
  futuro('B05', 'WT', 'West Texas Intermediocre', 'materia', 0.01, 2, 1000, { clave: 'MWT', valorPunto: 100 }),
  futuro('B06', 'FG', "Fool's Gold", 'materia', 0.1, 1, 100, { clave: 'MFG', valorPunto: 10 }),
  // Del tamaño de los futuros del euro: 125,000 euros por contrato y 12,500 el micro. El micro comparte las
  // operaciones del grande, así que también se mueve de 0.00005.
  futuro('B07', 'EW', 'Ewro', 'divisa', 0.00005, 5, 125_000, { clave: 'MEW', valorPunto: 12_500 }),
  cripto('B08', 'BTY', 'Bitcoyote', 0.01, 2, 0.00001),
  cripto('B09', 'ETR', 'Ethereal', 0.01, 2, 0.0001),
  cripto('B10', 'SLMI', 'Solami', 0.0001, 4, 0.01, 20200401),
  cripto('B11', 'FIDO', 'Fidocoin', 0.000001, 6, 1),
  cripto('B12', 'CHUPA', 'Chupacabras', 0.00000001, 8, 1, 20240101), // tick chico: su precio anda en milésimas
]

const porClave = new Map(MERCADOS.map((f) => [f.clave, f]))
const porId = new Map(MERCADOS.map((f) => [f.id, f]))

export function ficha(clave: string): Ficha {
  const f = porClave.get(clave as Clave)
  if (!f) throw new Error(`No hay un mercado con la clave ${clave}.`)
  return f
}

/** La ficha por su id interno (el que va en la semilla y en los archivos). */
export function fichaPorId(id: string): Ficha {
  const f = porId.get(id)
  if (!f) throw new Error(`No hay un mercado con el id ${id}.`)
  return f
}

/** Dólares que vale un tick por contrato (o por unidad en cripto). Con `micro`, los del micro. */
export function valorTick(f: Ficha, micro = false) {
  const punto = micro ? f.micro?.valorPunto : f.valorPunto
  if (punto === undefined) throw new Error(`${f.clave} no tiene micro.`)
  return Math.round(f.tick * punto * 1e9) / 1e9
}

/** El tick como entero en la última posición decimal: 0.25 con 2 decimales es 25. */
const tickEntero = (f: Ficha) => Math.round(f.tick * 10 ** f.decimales)

/** Precio en ticks a texto, exacto y con los decimales del mercado: 25601 ticks de MQ es "6400.25". */
export function textoPrecio(f: Ficha, ticks: number) {
  const entero = Math.abs(ticks) * tickEntero(f)
  const signo = ticks < 0 ? '-' : ''
  if (f.decimales === 0) return `${signo}${entero}`
  const s = String(entero).padStart(f.decimales + 1, '0')
  return `${signo}${s.slice(0, -f.decimales)}.${s.slice(-f.decimales)}`
}

export const precio = (f: Ficha, ticks: number) => Number(textoPrecio(f, ticks))

/** Precio a ticks, redondeado al tick más cercano. */
export const aTicks = (f: Ficha, p: number) => Math.round((p * 10 ** f.decimales) / tickEntero(f))

/** La sesión de un mercado en un día, o null si ese día no hay (también antes de que el mercado exista). */
export const sesionDe = (f: Ficha, dia: number): Sesion | null => (dia < f.desde ? null : sesion(f.horario, dia))
