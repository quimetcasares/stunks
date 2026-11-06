// Origen de los datos del NQ: la carpeta local practica/datos (no se versiona ni se publica).
import { abrirGzip, type Dia, decodificar, type MesInfo } from './datos'

const BASE = import.meta.env.DEV ? '/datos/nq' : '../datos/nq'
const cache = new Map<string, Dia[]>()

export async function cargarManifiesto(): Promise<MesInfo[]> {
  const r = await fetch(`${BASE}/manifest.json`, { cache: 'no-store' })
  if (!r.ok) throw new Error('No encontré tus datos del NQ (falta practica/datos/nq/manifest.json).')
  const j = (await r.json()) as { meses: MesInfo[] }
  return j.meses
}

export async function cargarMes(m: string): Promise<Dia[]> {
  const hit = cache.get(m)
  if (hit) return hit
  const r = await fetch(`${BASE}/m/${m}.bin.gz`)
  if (!r.ok) throw new Error(`No pude abrir el mes ${m} (${r.status}).`)
  const dias = decodificar(await abrirGzip(new Uint8Array(await r.arrayBuffer())))
  cache.set(m, dias)
  if (cache.size > 12) cache.delete(cache.keys().next().value!)
  return dias
}
