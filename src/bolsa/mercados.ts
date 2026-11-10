// SPDX-License-Identifier: MIT
// Ficha de contrato de los 12 mercados de la bolsa de Stunks: lo que la app necesita para mostrar precios
// y calcular resultados. Cómo se mueve cada mercado no va aquí; eso es del generador (decisión 0010).
import { HISTORICO_DESDE, type Horario, type Sesion, sesion } from './calendario.ts'

export type Clave = 'MQ' | 'EP' | 'DJ' | 'PU' | 'CR' | 'OR' | 'PS' | 'BTY' | 'ETR' | 'SOLE' | 'FIRU' | 'CHUPA'

export type Tipo = 'indice' | 'materia' | 'divisa' | 'cripto'

export interface Ficha {
  clave: Clave
  nombre: { es: string; en: string }
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
  clave: Clave,
  nombre: Ficha['nombre'],
  tipo: Tipo,
  tick: number,
  decimales: number,
  valorPunto: number,
  micro: Ficha['micro'],
): Ficha => ({ clave, nombre, tipo, horario: 'futuros', tick, decimales, valorPunto, micro, unidad: 1, desde: HISTORICO_DESDE })

const cripto = (
  clave: Clave,
  nombre: string,
  tick: number,
  decimales: number,
  unidad: number,
  desde = HISTORICO_DESDE,
): Ficha => ({
  clave,
  nombre: { es: nombre, en: nombre },
  tipo: 'cripto',
  horario: 'cripto',
  tick,
  decimales,
  valorPunto: 1,
  micro: null,
  unidad,
  desde,
})

const igual = (nombre: string) => ({ es: nombre, en: nombre })

/** Los 12 mercados, en el orden en que se muestran. */
export const MERCADOS: readonly Ficha[] = [
  futuro('MQ', igual('Madsaq 100'), 'indice', 0.25, 2, 20, { clave: 'MMQ', valorPunto: 2 }),
  futuro('EP', igual('Estándar & Pobres 500'), 'indice', 0.25, 2, 50, { clave: 'MEP', valorPunto: 5 }),
  futuro('DJ', igual('Down Jones 30'), 'indice', 1, 0, 5, { clave: 'MDJ', valorPunto: 0.5 }),
  futuro('PU', igual('Pulga 2000'), 'indice', 0.1, 1, 50, { clave: 'MPU', valorPunto: 5 }),
  futuro('CR', { es: 'Petróleo', en: 'Oil' }, 'materia', 0.01, 2, 1000, { clave: 'MCR', valorPunto: 100 }),
  futuro('OR', { es: 'Oro', en: 'Gold' }, 'materia', 0.1, 1, 100, { clave: 'MOR', valorPunto: 10 }),
  futuro('PS', igual('Peso'), 'divisa', 0.00001, 5, 500_000, null),
  cripto('BTY', 'Bitcoyote', 0.01, 2, 0.00001),
  cripto('ETR', 'Etéreo', 0.01, 2, 0.0001),
  cripto('SOLE', 'Solecito', 0.0001, 4, 0.01, 20200401),
  cripto('FIRU', 'Firulais', 0.000001, 6, 1),
  cripto('CHUPA', 'Chupacabras', 0.00000001, 8, 1, 20240101), // tick chico: su precio anda en milésimas
]

const porClave = new Map(MERCADOS.map((f) => [f.clave, f]))

export function ficha(clave: string): Ficha {
  const f = porClave.get(clave as Clave)
  if (!f) throw new Error(`No hay un mercado con la clave ${clave}.`)
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
