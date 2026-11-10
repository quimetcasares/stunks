// SPDX-License-Identifier: MIT
// Formato del libro de órdenes de la bolsa de Stunks (LIB1): fotos de los mejores niveles de compra y de venta.
// La especificación está en src/bolsa/README.md. También sirve para datos propios con profundidad (por ejemplo,
// MBP-10 convertido). No depende del navegador: corre igual en Node, Deno y cualquier navegador.
import { ErrorFormato } from './operaciones.ts'

/** El tramo que cubre un archivo de libro (igual que el de las operaciones). */
export interface TramoLibro {
  mercado: string // id del mercado (en la bolsa, el id interno de su ficha): de 1 a 8 letras mayúsculas o números
  dia: number // aaaammdd de la sesión
  version: number // versión del generador (0 si los datos no salen del generador)
  desde: number // ms UTC, incluido
  hasta: number // ms UTC, excluido
  niveles: number // niveles por lado, de 1 a 26
}

/**
 * Fotos del libro en columnas. La foto k tiene su tiempo, el mejor precio de compra (en ticks), el spread (en ticks,
 * 1 o más) y los tamaños de cada nivel: primero los `niveles` de compra desde el mejor hacia abajo, luego los de
 * venta desde el mejor hacia arriba (`tamanos[k * 2 * niveles + j]`). Un nivel vacío tiene tamaño 0.
 */
export interface Fotos {
  n: number
  t: Float64Array
  mejorBid: Int32Array
  spread: Int32Array
  tamanos: Uint32Array
}

export interface Libro extends TramoLibro {
  fotos: Fotos
}

export const MAGIA_LIBRO = 'LIB1'
export const ENCABEZADO_LIBRO = 48
const MAX_TAMANO = 0xffffffff

export function fotosVacias(n: number, niveles: number): Fotos {
  return {
    n,
    t: new Float64Array(n),
    mejorBid: new Int32Array(n),
    spread: new Int32Array(n),
    tamanos: new Uint32Array(n * 2 * niveles),
  }
}

// ─── Bytes ──────────────────────────────────────────────────────────────────

class Escritor {
  b: Uint8Array
  i = 0

  constructor(tam: number) {
    this.b = new Uint8Array(tam)
  }

  private asegurar(k: number) {
    if (this.i + k <= this.b.length) return
    const nuevo = new Uint8Array(Math.max(this.b.length * 2, this.i + k))
    nuevo.set(this.b)
    this.b = nuevo
  }

  /** Entero sin signo de 0 a 2^53 - 1, de 7 en 7 bits (LEB128). */
  varint(v: number) {
    this.asegurar(8)
    while (v >= 0x80) {
      this.b[this.i++] = (v % 0x80) | 0x80
      v = Math.floor(v / 0x80)
    }
    this.b[this.i++] = v
  }

  bytes() {
    return this.b.slice(0, this.i)
  }
}

class Lector {
  private u8: Uint8Array
  i: number

  constructor(u8: Uint8Array, inicio: number) {
    this.u8 = u8
    this.i = inicio
  }

  varint(): number {
    let v = 0
    let peso = 1
    for (;;) {
      if (this.i >= this.u8.length) throw new ErrorFormato('El archivo del libro está cortado.')
      const b = this.u8[this.i++]
      v += (b & 0x7f) * peso
      if (b < 0x80) return v
      peso *= 0x80
      if (peso > 2 ** 49) throw new ErrorFormato('Número demasiado largo en el archivo del libro.')
    }
  }

  get fin() {
    return this.i === this.u8.length
  }
}

const zigzag = (v: number) => (v >= 0 ? v * 2 : -v * 2 - 1)
const desZigzag = (z: number) => (z % 2 === 0 ? z / 2 : -(z + 1) / 2)
const bit = (j: number) => 2 ** j

function revisarTramo(a: TramoLibro) {
  if (!/^[A-Z0-9]{1,8}$/.test(a.mercado))
    throw new ErrorFormato('El id del mercado debe tener de 1 a 8 letras mayúsculas o números.')
  if (!Number.isInteger(a.dia) || a.dia < 0 || a.dia > 0xffffffff) throw new ErrorFormato('El día debe ser un número aaaammdd.')
  if (!Number.isInteger(a.version) || a.version < 0 || a.version > 0xffff)
    throw new ErrorFormato('La versión debe ir de 0 a 65535.')
  if (!Number.isInteger(a.niveles) || a.niveles < 1 || a.niveles > 26)
    throw new ErrorFormato('Los niveles por lado van de 1 a 26.')
  if (!Number.isSafeInteger(a.desde) || !Number.isSafeInteger(a.hasta) || a.desde > a.hasta)
    throw new ErrorFormato('El tramo debe ir de un entero de milisegundos a otro igual o mayor.')
}

/**
 * Arma el binario LIB1, sin comprimir. Cada foto guarda solo lo que cambió desde la anterior (la primera, todo).
 * Mismas fotos dan siempre los mismos bytes.
 */
export function codificarLibro(a: Libro): Uint8Array {
  revisarTramo(a)
  const { n, t, mejorBid, spread, tamanos } = a.fotos
  const lados = 2 * a.niveles
  if (tamanos.length !== n * lados) throw new ErrorFormato('Los tamaños no cuadran con las fotos y los niveles.')
  const e = new Escritor(ENCABEZADO_LIBRO + n * 8)
  const dv = new DataView(e.b.buffer)
  for (let k = 0; k < 4; k++) e.b[k] = MAGIA_LIBRO.charCodeAt(k)
  dv.setUint16(4, a.version, true)
  dv.setUint16(6, a.niveles, true)
  for (let k = 0; k < a.mercado.length; k++) e.b[8 + k] = a.mercado.charCodeAt(k)
  dv.setUint32(16, a.dia, true)
  dv.setUint32(20, n, true)
  dv.setFloat64(24, a.desde, true)
  dv.setFloat64(32, a.hasta, true)
  dv.setInt32(40, n > 0 ? mejorBid[0] : 0, true)
  e.i = ENCABEZADO_LIBRO

  let antes = a.desde
  let bidAntes = n > 0 ? mejorBid[0] : 0
  for (let k = 0; k < n; k++) {
    if (!Number.isSafeInteger(t[k]) || t[k] < antes || t[k] >= a.hasta)
      throw new ErrorFormato(`Foto ${k}: los tiempos deben ser enteros, en orden y dentro del tramo.`)
    if (!Number.isInteger(spread[k]) || spread[k] < 1) throw new ErrorFormato(`Foto ${k}: el spread debe ser de 1 tick o más.`)
    e.varint(t[k] - antes)
    e.varint(zigzag(mejorBid[k] - bidAntes))
    e.varint(spread[k] - 1)
    let mascara = 0
    for (let j = 0; j < lados; j++) {
      const ahora = tamanos[k * lados + j]
      if (k === 0 || ahora !== tamanos[(k - 1) * lados + j]) mascara += bit(j)
    }
    e.varint(mascara)
    for (let j = 0; j < lados; j++) if (Math.floor(mascara / bit(j)) % 2 === 1) e.varint(tamanos[k * lados + j])
    antes = t[k]
    bidAntes = mejorBid[k]
  }
  return e.bytes()
}

export function decodificarLibro(u8: Uint8Array): Libro {
  if (u8.length < ENCABEZADO_LIBRO) throw new ErrorFormato('El archivo del libro está cortado.')
  if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== MAGIA_LIBRO) throw new ErrorFormato('No es un archivo de libro (LIB1).')
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let mercado = ''
  for (let k = 8; k < 16 && u8[k] !== 0; k++) mercado += String.fromCharCode(u8[k])
  const tramo: TramoLibro = {
    mercado,
    dia: dv.getUint32(16, true),
    version: dv.getUint16(4, true),
    desde: dv.getFloat64(24, true),
    hasta: dv.getFloat64(32, true),
    niveles: dv.getUint16(6, true),
  }
  revisarTramo(tramo)
  const n = dv.getUint32(20, true)
  // Cada foto ocupa al menos 4 bytes: así un encabezado falso no pide memoria de más.
  if (n * 4 > u8.length - ENCABEZADO_LIBRO) throw new ErrorFormato('El archivo del libro está cortado.')
  const lados = 2 * tramo.niveles
  const fotos = fotosVacias(n, tramo.niveles)
  const l = new Lector(u8, ENCABEZADO_LIBRO)
  let t = tramo.desde
  let bid = dv.getInt32(40, true)
  for (let k = 0; k < n; k++) {
    t += l.varint()
    if (t >= tramo.hasta) throw new ErrorFormato(`Foto ${k}: queda fuera del tramo.`)
    bid += desZigzag(l.varint())
    if (bid < -0x80000000 || bid > 0x7fffffff) throw new ErrorFormato(`Foto ${k}: precio fuera de rango.`)
    fotos.t[k] = t
    fotos.mejorBid[k] = bid
    fotos.spread[k] = l.varint() + 1
    const mascara = l.varint()
    if (mascara >= bit(lados)) throw new ErrorFormato(`Foto ${k}: máscara de niveles fuera de rango.`)
    if (k === 0 && mascara !== bit(lados) - 1) throw new ErrorFormato('La primera foto debe traer todos los niveles.')
    for (let j = 0; j < lados; j++) {
      if (Math.floor(mascara / bit(j)) % 2 === 1) {
        const v = l.varint()
        if (v > MAX_TAMANO) throw new ErrorFormato(`Foto ${k}: tamaño fuera de rango.`)
        fotos.tamanos[k * lados + j] = v
      } else fotos.tamanos[k * lados + j] = fotos.tamanos[(k - 1) * lados + j]
    }
  }
  if (!l.fin) throw new ErrorFormato('Sobran bytes al final del archivo del libro.')
  return { ...tramo, fotos }
}

// ─── DOM ────────────────────────────────────────────────────────────────────

export interface Nivel {
  precio: number // ticks
  tamano: number
}

export interface Escalera {
  t: number // tiempo de la foto
  compras: Nivel[] // del mejor precio hacia abajo
  ventas: Nivel[] // del mejor precio hacia arriba
}

/** La escalera del DOM en un momento: la última foto en o antes de `t` (null si todavía no hay ninguna). */
export function escaleraEn(libro: Libro, t: number): Escalera | null {
  const f = libro.fotos
  let lo = 0
  let hi = f.n - 1
  let k = -1
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (f.t[m] <= t) {
      k = m
      lo = m + 1
    } else hi = m - 1
  }
  if (k < 0) return null
  const N = libro.niveles
  const base = k * 2 * N
  const compras: Nivel[] = []
  const ventas: Nivel[] = []
  for (let j = 0; j < N; j++) {
    compras.push({ precio: f.mejorBid[k] - j, tamano: f.tamanos[base + j] })
    ventas.push({ precio: f.mejorBid[k] + f.spread[k] + j, tamano: f.tamanos[base + N + j] })
  }
  return { t: f.t[k], compras, ventas }
}
