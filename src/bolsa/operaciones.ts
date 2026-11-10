// SPDX-License-Identifier: MIT
// Formato de operaciones de la bolsa de Stunks (OPR1). La especificación está en src/bolsa/README.md.
// No depende del navegador: corre igual en Node, Deno y cualquier navegador.

/** Una operación del mercado. */
export interface Operacion {
  t: number // milisegundos desde la época UTC
  p: number // precio en ticks (entero)
  q: number // cantidad en la unidad mínima del mercado (entero, 1 o más)
  lado: 1 | -1 // 1 si pegó contra la venta (compra agresiva), -1 si pegó contra la compra
}

/** Muchas operaciones en columnas, para no crear un objeto por operación. */
export interface Operaciones {
  n: number
  t: Float64Array
  p: Int32Array
  q: Uint32Array
  lado: Int8Array
}

/** El tramo que cubre un archivo: un día completo o un bloque de un día. */
export interface Tramo {
  mercado: string // clave del mercado: de 1 a 8 letras mayúsculas o números
  dia: number // aaaammdd de la sesión
  version: number // versión del generador (0 si los datos no salen del generador)
  desde: number // ms UTC, incluido
  hasta: number // ms UTC, excluido
}

export interface Archivo extends Tramo {
  ops: Operaciones
}

export class ErrorFormato extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorFormato'
  }
}

export const MAGIA = 'OPR1'
export const ENCABEZADO = 48
const MAX_Q = 0xffffffff
const MIN_P = -0x80000000
const MAX_P = 0x7fffffff

// ─── Conversión entre objetos y columnas ────────────────────────────────────

export function vacias(n = 0): Operaciones {
  return { n, t: new Float64Array(n), p: new Int32Array(n), q: new Uint32Array(n), lado: new Int8Array(n) }
}

/** Pasa una lista de operaciones a columnas, revisando que cada valor quepa en su columna. */
export function aColumnas(lista: readonly Operacion[]): Operaciones {
  const ops = vacias(lista.length)
  lista.forEach((o, i) => {
    if (!Number.isSafeInteger(o.t)) throw new ErrorFormato(`Operación ${i}: el tiempo debe ser un entero de milisegundos.`)
    if (!Number.isInteger(o.p) || o.p < MIN_P || o.p > MAX_P)
      throw new ErrorFormato(`Operación ${i}: el precio debe ser un entero de 32 bits en ticks.`)
    if (!Number.isInteger(o.q) || o.q < 1 || o.q > MAX_Q)
      throw new ErrorFormato(`Operación ${i}: la cantidad debe ser un entero de 1 a ${MAX_Q}.`)
    if (o.lado !== 1 && o.lado !== -1) throw new ErrorFormato(`Operación ${i}: el lado debe ser 1 o -1.`)
    ops.t[i] = o.t
    ops.p[i] = o.p
    ops.q[i] = o.q
    ops.lado[i] = o.lado
  })
  return ops
}

export function aLista(ops: Operaciones): Operacion[] {
  const lista: Operacion[] = []
  for (let i = 0; i < ops.n; i++) lista.push({ t: ops.t[i], p: ops.p[i], q: ops.q[i], lado: ops.lado[i] === 1 ? 1 : -1 })
  return lista
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
  i: number

  constructor(
    private u8: Uint8Array,
    inicio: number,
  ) {
    this.i = inicio
  }

  varint(): number {
    let v = 0
    let peso = 1
    for (;;) {
      if (this.i >= this.u8.length) throw new ErrorFormato('El archivo de operaciones está cortado.')
      const b = this.u8[this.i++]
      v += (b & 0x7f) * peso
      if (b < 0x80) return v
      peso *= 0x80
      if (peso > 2 ** 49) throw new ErrorFormato('Número demasiado largo en el archivo de operaciones.')
    }
  }

  get fin() {
    return this.i === this.u8.length
  }
}

/** Entero con signo a sin signo: 0, -1, 1, -2, 2… pasan a 0, 1, 2, 3, 4… */
const zigzag = (v: number) => (v >= 0 ? v * 2 : -v * 2 - 1)
const desZigzag = (z: number) => (z % 2 === 0 ? z / 2 : -(z + 1) / 2)

// ─── Codificar y decodificar ────────────────────────────────────────────────

function revisarTramo(a: Tramo) {
  if (!/^[A-Z0-9]{1,8}$/.test(a.mercado))
    throw new ErrorFormato('La clave del mercado debe tener de 1 a 8 letras mayúsculas o números.')
  if (!Number.isInteger(a.dia) || a.dia < 0 || a.dia > 0xffffffff) throw new ErrorFormato('El día debe ser un número aaaammdd.')
  if (!Number.isInteger(a.version) || a.version < 0 || a.version > 0xffff)
    throw new ErrorFormato('La versión debe ir de 0 a 65535.')
  if (!Number.isSafeInteger(a.desde) || !Number.isSafeInteger(a.hasta) || a.desde > a.hasta)
    throw new ErrorFormato('El tramo debe ir de un entero de milisegundos a otro igual o mayor.')
}

/** Arma el binario OPR1, sin comprimir. Mismas operaciones dan siempre los mismos bytes. */
export function codificar(a: Archivo): Uint8Array {
  revisarTramo(a)
  const { n, t, p, q, lado } = a.ops
  const e = new Escritor(ENCABEZADO + n * 6)
  const dv = new DataView(e.b.buffer)
  for (let k = 0; k < 4; k++) e.b[k] = MAGIA.charCodeAt(k)
  dv.setUint16(4, a.version, true)
  for (let k = 0; k < a.mercado.length; k++) e.b[8 + k] = a.mercado.charCodeAt(k)
  dv.setUint32(16, a.dia, true)
  dv.setUint32(20, n, true)
  dv.setFloat64(24, a.desde, true)
  dv.setFloat64(32, a.hasta, true)
  dv.setInt32(40, n > 0 ? p[0] : 0, true)
  e.i = ENCABEZADO

  let antes = a.desde
  for (let i = 0; i < n; i++) {
    const ti = t[i]
    if (!Number.isSafeInteger(ti) || ti < antes || ti >= a.hasta)
      throw new ErrorFormato(`Operación ${i}: los tiempos deben ser enteros, en orden y dentro del tramo.`)
    e.varint(ti - antes)
    antes = ti
  }
  for (let i = 0; i < n; i++) e.varint(zigzag(i === 0 ? 0 : p[i] - p[i - 1]))
  for (let i = 0; i < n; i++) {
    if (q[i] < 1) throw new ErrorFormato(`Operación ${i}: la cantidad debe ser 1 o más.`)
    if (lado[i] !== 1 && lado[i] !== -1) throw new ErrorFormato(`Operación ${i}: el lado debe ser 1 o -1.`)
    e.varint(q[i] * 2 + (lado[i] === 1 ? 1 : 0))
  }
  return e.bytes()
}

export function decodificar(u8: Uint8Array): Archivo {
  if (u8.length < ENCABEZADO) throw new ErrorFormato('El archivo de operaciones está cortado.')
  if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== MAGIA) throw new ErrorFormato('No es un archivo de operaciones (OPR1).')
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let mercado = ''
  for (let k = 8; k < 16 && u8[k] !== 0; k++) mercado += String.fromCharCode(u8[k])
  const tramo: Tramo = {
    mercado,
    dia: dv.getUint32(16, true),
    version: dv.getUint16(4, true),
    desde: dv.getFloat64(24, true),
    hasta: dv.getFloat64(32, true),
  }
  revisarTramo(tramo)
  const n = dv.getUint32(20, true)
  const p0 = dv.getInt32(40, true)
  // Cada operación ocupa al menos 3 bytes: así un encabezado falso no pide memoria de más.
  if (n * 3 > u8.length - ENCABEZADO) throw new ErrorFormato('El archivo de operaciones está cortado.')

  const ops = vacias(n)
  const l = new Lector(u8, ENCABEZADO)
  let t = tramo.desde
  for (let i = 0; i < n; i++) {
    t += l.varint()
    if (t >= tramo.hasta) throw new ErrorFormato(`Operación ${i}: queda fuera del tramo.`)
    ops.t[i] = t
  }
  let p = p0
  for (let i = 0; i < n; i++) {
    p += desZigzag(l.varint())
    if (p < MIN_P || p > MAX_P) throw new ErrorFormato(`Operación ${i}: precio fuera de rango.`)
    ops.p[i] = p
  }
  for (let i = 0; i < n; i++) {
    const v = l.varint()
    const q = Math.floor(v / 2)
    if (q < 1 || q > MAX_Q) throw new ErrorFormato(`Operación ${i}: cantidad fuera de rango.`)
    ops.q[i] = q
    ops.lado[i] = v % 2 === 1 ? 1 : -1
  }
  if (!l.fin) throw new ErrorFormato('Sobran bytes al final del archivo de operaciones.')
  return { ...tramo, ops }
}

// ─── gzip ───────────────────────────────────────────────────────────────────
// Los bytes comprimidos pueden cambiar entre Node, Deno y navegadores; lo que se compara es el binario sin comprimir.

async function pasar(u8: Uint8Array, flujo: CompressionStream | DecompressionStream) {
  const s = new Blob([u8 as BlobPart]).stream().pipeThrough(flujo)
  return new Uint8Array(await new Response(s).arrayBuffer())
}

export const comprimir = (u8: Uint8Array) => pasar(u8, new CompressionStream('gzip'))

/** Descomprime si viene en gzip; si no, lo regresa igual (hay servidores que ya lo entregan descomprimido). */
export const descomprimir = async (u8: Uint8Array) =>
  u8[0] === 0x1f && u8[1] === 0x8b ? pasar(u8, new DecompressionStream('gzip')) : u8

/** Lee un archivo de operaciones, comprimido o no. */
export const leer = async (u8: Uint8Array) => decodificar(await descomprimir(u8))
