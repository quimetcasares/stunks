// Velas de 250 de volumen del NQ en el formato del juego (NQJ1, un archivo por mes).
// Tiempos en segundos desde las 18:00 ET del día anterior (la reapertura); precios en ticks.
// Este archivo no depende del navegador: también lo usan las pruebas del motor.

export interface Dia {
  fecha: number // aaaammdd de la sesión
  t0: number // época UTC de las 18:00 ET en que abre la sesión
  pad: boolean // día anterior que viene al principio del mes, solo para ver hacia atrás
  n: number
  t: Int32Array
  o: Int32Array
  h: Int32Array
  l: Int32Array
  c: Int32Array
  g: Int32Array // a qué vela de 2500 pertenece cada vela de 250
  vol: Int32Array
  bv: Int32Array
}

export interface MesInfo {
  m: string // aaaa-mm
  dias: number
  velas: number
}

/**
 * Error de datos con clave, para que la interfaz lo muestre en el idioma elegido (`p.avisos` en src/i18n.ts).
 * El mensaje queda en español para las herramientas y las pruebas.
 */
export class ErrorDatos extends Error {
  clave: 'formato' | 'sinManifiesto' | 'sinEjemplo' | 'mesNoAbre'
  dato: string

  constructor(clave: ErrorDatos['clave'], mensaje: string, dato = '') {
    super(mensaje)
    this.name = 'ErrorDatos'
    this.clave = clave
    this.dato = dato
  }
}

/** Descomprime si viene en gzip (algunos servidores ya lo entregan descomprimido). */
export async function abrirGzip(u8: Uint8Array): Promise<ArrayBuffer> {
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    const s = new Blob([u8 as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
    return await new Response(s).arrayBuffer()
  }
  return u8.slice().buffer
}

export function decodificar(ab: ArrayBuffer): Dia[] {
  const dv = new DataView(ab)
  const magia = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
  if (magia !== 'NQJ1') throw new ErrorDatos('formato', 'Archivo de velas con formato desconocido.')
  const nd = dv.getUint16(4, true)
  const nb = dv.getUint32(8, true)
  let off = 16 + 20 * nd
  const u16 = () => {
    const a = new Uint16Array(ab, off, nb)
    off += a.byteLength
    return a
  }
  const i16 = () => {
    const a = new Int16Array(ab, off, nb)
    off += a.byteLength
    return a
  }
  const dt = u16()
  const dc = i16()
  const dO = i16()
  const hu = u16()
  const lu = u16()
  const v = u16()
  const bv = u16()
  const dg = new Uint8Array(ab, off, nb)

  const dias: Dia[] = []
  let k = 0
  for (let d = 0; d < nd; d++) {
    const p = 16 + 20 * d
    const fecha = dv.getUint32(p, true)
    const t0 = dv.getUint32(p + 4, true)
    const n = dv.getUint32(p + 8, true)
    const base = dv.getInt32(p + 12, true)
    const pad = dv.getUint8(p + 16) === 1
    const D: Dia = {
      fecha,
      t0,
      pad,
      n,
      t: new Int32Array(n),
      o: new Int32Array(n),
      h: new Int32Array(n),
      l: new Int32Array(n),
      c: new Int32Array(n),
      g: new Int32Array(n),
      vol: new Int32Array(n),
      bv: new Int32Array(n),
    }
    let tt = 0
    let cc = base
    let gg = 0
    for (let j = 0; j < n; j++, k++) {
      tt += dt[k]
      const oo = cc + dO[k]
      cc += dc[k]
      gg += dg[k]
      D.t[j] = tt
      D.o[j] = oo
      D.c[j] = cc
      D.h[j] = Math.max(oo, cc) + hu[k]
      D.l[j] = Math.min(oo, cc) - lu[k]
      D.g[j] = gg
      D.vol[j] = v[k]
      D.bv[j] = bv[k]
    }
    dias.push(D)
  }
  return dias
}

/** "09:30" en hora de Nueva York, a partir de segundos desde las 18:00 ET. */
export function horaNY(t: number, conSegundos = false) {
  const s = (64800 + t) % 86400
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const dos = (x: number) => String(x).padStart(2, '0')
  return `${dos(hh)}:${dos(mm)}${conSegundos ? `:${dos(ss)}` : ''}`
}

/** "09:30" (hora de Nueva York) a segundos desde las 18:00 ET. */
export function segundosDesdeReapertura(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const hh = h >= 18 ? h - 18 : h + 6
  return hh * 3600 + (m || 0) * 60
}

export function fechaTexto(f: number) {
  const s = String(f)
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}
