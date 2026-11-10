// SPDX-License-Identifier: MIT
// Calendario de sesiones de la bolsa de Stunks, en hora de Nueva York.
// No usa Intl ni datos de zonas horarias: el cambio de horario y los feriados salen de reglas fijas,
// así que el resultado es el mismo en Node, Deno y cualquier navegador.

/** Futuros: de 18:00 a 17:00 de Nueva York, de domingo en la noche a viernes, con feriados. Cripto: siempre abierta. */
export type Horario = 'futuros' | 'cripto'

/** Una sesión lleva la fecha del día en que cierra; abre a las 18:00 de Nueva York del día anterior. */
export interface Sesion {
  dia: number // aaaammdd
  abre: number // ms UTC, incluido
  cierra: number // ms UTC, excluido
  corta: boolean // cierra temprano por feriado
}

export type IdFeriado =
  | 'anoNuevo'
  | 'viernesSanto'
  | 'navidad'
  | 'mlk'
  | 'presidentes'
  | 'memorial'
  | 'juneteenth'
  | 'independencia'
  | 'trabajo'
  | 'gracias'
  | 'despuesDeGracias'
  | 'nochebuena'

export interface Feriado {
  id: IdFeriado
  cierra: readonly [number, number] | null // hora y minuto de Nueva York; null si no hay sesión
}

/** Primer día del histórico de la bolsa. */
export const HISTORICO_DESDE = 20180102

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

// ─── Fechas aaaammdd ────────────────────────────────────────────────────────

export const fecha = (y: number, m: number, d: number) => y * 10000 + m * 100 + d

export const partes = (f: number) => ({ y: Math.floor(f / 10000), m: Math.floor(f / 100) % 100, d: f % 100 })

const medianocheUtc = (f: number) => {
  const { y, m, d } = partes(f)
  return Date.UTC(y, m - 1, d)
}

const deUtc = (ms: number) => {
  const x = new Date(ms)
  return fecha(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate())
}

export const sumarDias = (f: number, k: number) => deUtc(medianocheUtc(f) + k * DIA)

/** 0 domingo, 1 lunes … 6 sábado. */
export const diaDeLaSemana = (f: number) => new Date(medianocheUtc(f)).getUTCDay()

/** El n-ésimo día `dow` del mes (n = -1 es el último). */
function enesimo(y: number, m: number, dow: number, n: number) {
  if (n > 0) {
    const primero = diaDeLaSemana(fecha(y, m, 1))
    return fecha(y, m, 1 + ((dow - primero + 7) % 7) + (n - 1) * 7)
  }
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const ultimo = diaDeLaSemana(fecha(y, m, ultimoDia))
  return fecha(y, m, ultimoDia - ((ultimo - dow + 7) % 7))
}

// ─── Hora de Nueva York ─────────────────────────────────────────────────────

/**
 * Horas de diferencia de Nueva York con UTC en ese instante: -4 en horario de verano y -5 el resto.
 * Reglas de EE.UU. desde 2007: el verano va de las 2:00 del segundo domingo de marzo a las 2:00 del primer domingo de noviembre.
 */
export function desfaseNY(ms: number) {
  const y = new Date(ms).getUTCFullYear()
  const inicio = medianocheUtc(enesimo(y, 3, 0, 2)) + 7 * HORA // 2:00 de invierno = 7:00 UTC
  const fin = medianocheUtc(enesimo(y, 11, 0, 1)) + 6 * HORA // 2:00 de verano = 6:00 UTC
  return ms >= inicio && ms < fin ? -4 : -5
}

/** Fecha y hora de Nueva York de un instante. */
export function horaNY(ms: number) {
  const x = new Date(ms + desfaseNY(ms) * HORA)
  return {
    dia: fecha(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()),
    h: x.getUTCHours(),
    m: x.getUTCMinutes(),
    s: x.getUTCSeconds(),
  }
}

/** Instante UTC de una hora de Nueva York. No se usa con las horas que faltan o se repiten al cambiar de horario. */
export function enNY(dia: number, h: number, m = 0) {
  const reloj = medianocheUtc(dia) + h * HORA + m * MINUTO
  const invierno = reloj + 5 * HORA
  return desfaseNY(invierno) === -4 ? reloj + 4 * HORA : invierno
}

// ─── Feriados de los futuros ────────────────────────────────────────────────

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
export function pascua(y: number) {
  const a = y % 19
  const b = Math.floor(y / 100)
  const c = y % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const x = h + l - 7 * m + 114
  return fecha(y, Math.floor(x / 31), (x % 31) + 1)
}

/** Un feriado fijo que cae en sábado se descansa el viernes; en domingo, el lunes. */
function observado(f: number) {
  const w = diaDeLaSemana(f)
  return w === 6 ? sumarDias(f, -1) : w === 0 ? sumarDias(f, 1) : f
}

const CIERRE_FERIADO = [13, 0] as const
const CIERRE_VISPERA = [13, 15] as const
const porAno = new Map<number, Map<number, Feriado>>()

/** Feriados de los futuros en un año: sin sesión, o con cierre a las 13:00 o 13:15 de Nueva York. */
export function feriados(y: number): Map<number, Feriado> {
  const hecho = porAno.get(y)
  if (hecho) return hecho
  const lista: [number, Feriado][] = []
  const cerrado = (id: IdFeriado) => ({ id, cierra: null })
  const corto = (id: IdFeriado, cierra: readonly [number, number] = CIERRE_FERIADO) => ({ id, cierra })

  // Año Nuevo en sábado no se descansa el viernes anterior: ese viernes es de otro año.
  const anoNuevo = fecha(y, 1, 1)
  if (diaDeLaSemana(anoNuevo) !== 6) lista.push([observado(anoNuevo), cerrado('anoNuevo')])
  lista.push([sumarDias(pascua(y), -2), cerrado('viernesSanto')])
  lista.push([observado(fecha(y, 12, 25)), cerrado('navidad')])

  lista.push([enesimo(y, 1, 1, 3), corto('mlk')])
  lista.push([enesimo(y, 2, 1, 3), corto('presidentes')])
  lista.push([enesimo(y, 5, 1, -1), corto('memorial')])
  if (y >= 2022) lista.push([observado(fecha(y, 6, 19)), corto('juneteenth')])
  lista.push([observado(fecha(y, 7, 4)), corto('independencia')])
  lista.push([enesimo(y, 9, 1, 1), corto('trabajo')])
  const gracias = enesimo(y, 11, 4, 4)
  lista.push([gracias, corto('gracias')])
  lista.push([sumarDias(gracias, 1), corto('despuesDeGracias', CIERRE_VISPERA)])
  // Nochebuena de lunes a jueves; en viernes ya es el descanso de Navidad.
  const nochebuena = fecha(y, 12, 24)
  const w = diaDeLaSemana(nochebuena)
  if (w >= 1 && w <= 4) lista.push([nochebuena, corto('nochebuena', CIERRE_VISPERA)])

  const mapa = new Map(lista)
  porAno.set(y, mapa)
  return mapa
}

export const feriado = (dia: number) => feriados(partes(dia).y).get(dia) ?? null

// ─── Sesiones ───────────────────────────────────────────────────────────────

/** La sesión de un día, o null si ese día no hay. */
export function sesion(horario: Horario, dia: number): Sesion | null {
  const abre = enNY(sumarDias(dia, -1), 18)
  if (horario === 'cripto') return { dia, abre, cierra: enNY(dia, 18), corta: false }
  const w = diaDeLaSemana(dia)
  if (w === 0 || w === 6) return null
  const f = feriado(dia)
  if (f && f.cierra === null) return null
  const [h, m] = f?.cierra ?? [17, 0]
  return { dia, abre, cierra: enNY(dia, h, m), corta: f !== null }
}

/** La sesión que está abierta en ese instante, o null si está cerrado. */
export function sesionEn(horario: Horario, ms: number): Sesion | null {
  const { dia, h } = horaNY(ms)
  const s = sesion(horario, h >= 18 ? sumarDias(dia, 1) : dia)
  return s && ms >= s.abre && ms < s.cierra ? s : null
}

/** Las sesiones de `desde` a `hasta`, los dos incluidos. */
export function sesiones(horario: Horario, desde: number, hasta: number): Sesion[] {
  const lista: Sesion[] = []
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    const s = sesion(horario, d)
    if (s) lista.push(s)
  }
  return lista
}
