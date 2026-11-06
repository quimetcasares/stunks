// Origen de los datos de la práctica:
//  - En local (npm run dev y practicar.bat): la carpeta practica/datos con el NQ, que no se versiona ni se publica.
//  - En la web publicada: el mercado de mentira, armado en el navegador (ver docs/decisiones/0006-web-sin-datos-reales.md).
import { WEB } from '../config'
import { abrirGzip, type Dia, decodificar, ErrorDatos, type MesInfo } from './datos'
import { codificar, type MesFalso, mercadoDeMentira } from './sintetico'

const BASE = import.meta.env.DEV ? '/datos/nq' : '../datos/nq'
const cache = new Map<string, Dia[]>()

let mentira: MesFalso[] | null = null
const deMentira = () => {
  mentira ??= mercadoDeMentira()
  return mentira
}

export async function cargarManifiesto(): Promise<MesInfo[]> {
  if (WEB) {
    return deMentira().map(({ m, dias }) => ({
      m,
      dias: dias.filter((D) => !D.pad).length,
      velas: dias.reduce((a, D) => a + D.velas.length, 0),
    }))
  }
  const r = await fetch(`${BASE}/manifest.json`, { cache: 'no-store' })
  if (!r.ok) throw new ErrorDatos('sinManifiesto', 'No encontré los datos del NQ (falta practica/datos/nq/manifest.json).')
  const j = (await r.json()) as { meses: MesInfo[] }
  return j.meses
}

export async function cargarMes(m: string): Promise<Dia[]> {
  const hit = cache.get(m)
  if (hit) return hit
  const dias = WEB ? mesDeMentira(m) : await mesLocal(m)
  cache.set(m, dias)
  if (cache.size > 12) cache.delete(cache.keys().next().value!)
  return dias
}

function mesDeMentira(m: string): Dia[] {
  const mes = deMentira().find((x) => x.m === m)
  if (!mes) throw new ErrorDatos('sinEjemplo', `No hay datos de ejemplo del mes ${m}.`, m)
  return decodificar(codificar(mes.dias).buffer as ArrayBuffer)
}

async function mesLocal(m: string): Promise<Dia[]> {
  const r = await fetch(`${BASE}/m/${m}.bin.gz`)
  if (!r.ok) throw new ErrorDatos('mesNoAbre', `No pude abrir el mes ${m} (${r.status}).`, `${m} (${r.status})`)
  return decodificar(await abrirGzip(new Uint8Array(await r.arrayBuffer())))
}
