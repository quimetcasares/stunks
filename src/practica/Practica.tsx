import { useEffect, useMemo, useRef, useState } from 'react'
import { WEB } from '../config'
import { type Dia, fechaTexto, horaNY, type MesInfo, segundosDesdeReapertura } from './datos'
import { cargarManifiesto, cargarMes } from './fuente'
import { Graficas, type Marca } from './graficas'
import { NQ, type Resultado, resolver, velaDeCierre } from './motor'

type Inicio = 'reapertura' | 'ny' | 'hora' | 'azar'
const VELOCIDADES = [1, 2, 5, 10, 50, 100]
const T_FIN_SORTEO = 78000 // 15:40 ET
const T_NY_PREVIA = 54900 // 9:15 ET, 15 min antes de la apertura

interface Sesion {
  D: Dia
  P: Dia | null
}

interface Posicion {
  lado: 1 | -1
  e: number
  stopPts: number
  objPts: number
  contratos: number
  res: Resultado
  contra: Resultado
  hora: string
}

interface Jugada {
  id: number
  fecha: number
  hora: string
  contratos: number
  stopPts: number
  objPts: number
  ciegas: boolean
  res: Resultado
  contra: Resultado
}

interface Registro {
  fecha: number
  hora: string
  lado: 1 | -1
  contratos: number
  stop: number
  obj: number
  tipo: string
  R: number
  usd: number
  contraR: number
  ciegas: boolean
  cuando: number
}

const leer = <T,>(k: string, def: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : def
  } catch {
    return def
  }
}
const guardar = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

const completa = (D: Dia, j: number, reloj: number) => (j + 1 < D.n ? D.t[j + 1] <= reloj : reloj >= D.t[D.n - 1] + 60)
const contar = (D: Dia, reloj: number) => {
  let r = 0
  while (r < D.n && completa(D, r, reloj)) r++
  return r
}
const fmt = (x: number, d = 2) => x.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d })
const signo = (x: number, d = 2) => {
  const v = Number(x.toFixed(d)) + 0 // sin "-0"
  return `${v > 0 ? '+' : ''}${fmt(v, d)}`
}
const tono = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '')
const fechaLarga = (f: number) => {
  const s = String(f)
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function resumen(lista: { R: number; usd: number; contraR: number }[]) {
  const n = lista.length
  const ganadas = lista.filter((x) => x.R > 0).length
  return {
    n,
    pct: n ? (ganadas / n) * 100 : 0,
    R: lista.reduce((a, x) => a + x.R, 0),
    usd: lista.reduce((a, x) => a + x.usd, 0),
    contraR: lista.reduce((a, x) => a + x.contraR, 0),
  }
}

export function Practica() {
  const [meses, setMeses] = useState<MesInfo[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const cfg0 = leer('stunks.cfg', { inicio: 'reapertura' as Inicio, hora: '18:00', desde: 2018, ciegas: false })
  const [fecha, setFecha] = useState('')
  const [inicio, setInicio] = useState<Inicio>(cfg0.inicio)
  const [hora, setHora] = useState(cfg0.hora)
  const [desde, setDesde] = useState(cfg0.desde)
  const [ciegas, setCiegas] = useState(cfg0.ciegas)

  const orden0 = leer('stunks.orden', { contratos: 1, stop: 50, obj: 50 })
  const [contratos, setContratos] = useState(orden0.contratos)
  const [stopPts, setStopPts] = useState(orden0.stop)
  const [objPts, setObjPts] = useState(orden0.obj)

  const [vel, setVel] = useState(leer('stunks.vel', 10))
  const [jugando, setJugando] = useState(false)
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [vista, setVista] = useState({ r: 0, reloj: 0 })
  const [pos, setPos] = useState<Posicion | null>(null)
  const [jugadas, setJugadas] = useState<Jugada[]>([])
  const [historial, setHistorial] = useState<Registro[]>(() => leer('stunks.diario.v1', [] as Registro[]))
  const [revelada, setRevelada] = useState(false)

  const elGrande = useRef<HTMLDivElement>(null)
  const elChica = useRef<HTMLDivElement>(null)
  const graf = useRef<Graficas | null>(null)
  const sesionRef = useRef<Sesion | null>(null)
  const rRef = useRef(0)
  const relojRef = useRef(0)
  const velRef = useRef(vel)
  const posRef = useRef<Posicion | null>(null)
  const jugadasRef = useRef<Jugada[]>([])
  const baseRef = useRef(0)
  const ciegasRef = useRef(ciegas)

  velRef.current = vel
  ciegasRef.current = ciegas && !revelada

  useEffect(() => guardar('stunks.cfg', { inicio, hora, desde, ciegas }), [inicio, hora, desde, ciegas])
  useEffect(() => guardar('stunks.orden', { contratos, stop: stopPts, obj: objPts }), [contratos, stopPts, objPts])
  useEffect(() => guardar('stunks.vel', vel), [vel])

  // gráficas
  useEffect(() => {
    if (!elGrande.current || !elChica.current) return
    const formato = (p: number) => {
      if (!ciegasRef.current) return fmt(p, 2)
      const v = p - baseRef.current
      return `${v >= 0 ? '+' : ''}${fmt(v, 2)}`
    }
    graf.current = new Graficas(elGrande.current, elChica.current, formato)
    return () => {
      graf.current?.destruir()
      graf.current = null
    }
  }, [])

  // al cambiar el modo a ciegas o revelar, se repintan los precios
  // biome-ignore lint/correctness/useExhaustiveDependencies: el formato lee refs; ciegas y revelada solo disparan el repintado
  useEffect(() => {
    const f = (p: number) => {
      if (!ciegasRef.current) return fmt(p, 2)
      const v = p - baseRef.current
      return `${v >= 0 ? '+' : ''}${fmt(v, 2)}`
    }
    graf.current?.formato(f)
  }, [ciegas, revelada])

  // meses disponibles
  useEffect(() => {
    cargarManifiesto()
      .then((m) => {
        setMeses(m)
        if (m.length) setFecha(`${m[m.length - 1].m}-01`)
      })
      .catch((e: Error) => setAviso(e.message))
  }, [])

  const marcasDelDia = (lista: Jugada[], p: Posicion | null, D: Dia): Marca[] => {
    const out: Marca[] = []
    for (const j of lista) {
      if (j.fecha !== D.fecha) continue
      out.push({ vela: j.res.e, tipo: 'entrada', lado: j.res.lado, texto: j.res.lado > 0 ? 'C' : 'V' })
      out.push({ vela: j.res.js, tipo: 'salida', lado: j.res.lado, texto: `${signo(j.res.R, 1)}R` })
    }
    if (p) out.push({ vela: p.e, tipo: 'entrada', lado: p.lado, texto: p.lado > 0 ? 'C' : 'V' })
    return out
  }

  function finalizar(res: Resultado, contra: Resultado) {
    const S = sesionRef.current!
    const p = posRef.current!
    const j: Jugada = {
      id: Date.now(),
      fecha: S.D.fecha,
      hora: p.hora,
      contratos: p.contratos,
      stopPts: p.stopPts,
      objPts: p.objPts,
      ciegas: ciegasRef.current,
      res,
      contra,
    }
    const lista = [j, ...jugadasRef.current]
    jugadasRef.current = lista
    setJugadas(lista)
    const reg: Registro = {
      fecha: j.fecha,
      hora: j.hora,
      lado: res.lado,
      contratos: j.contratos,
      stop: j.stopPts,
      obj: j.objPts,
      tipo: res.tipo,
      R: res.R,
      usd: res.usd,
      contraR: contra.R,
      ciegas: j.ciegas,
      cuando: Date.now(),
    }
    setHistorial((h) => {
      const nuevo = [...h, reg]
      guardar('stunks.diario.v1', nuevo)
      return nuevo
    })
    posRef.current = null
    setPos(null)
    graf.current?.quitarLineas()
    graf.current?.marcar(marcasDelDia(lista, null, S.D))
  }

  function avanzarA(r: number) {
    const S = sesionRef.current
    if (!S) return
    rRef.current = r
    graf.current?.revelar(r)
    const p = posRef.current
    if (p && r > p.res.js) finalizar(p.res, p.contra)
    else graf.current?.marcar(marcasDelDia(jugadasRef.current, p, S.D))
    setVista({ r, reloj: relojRef.current })
  }

  // el reloj del replay
  // biome-ignore lint/correctness/useExhaustiveDependencies: el ciclo solo depende de jugando; lo demás se lee de refs
  useEffect(() => {
    if (!jugando) return
    let raf = 0
    let antes = performance.now()
    let ultimoPintado = 0
    const cuadro = (ahora: number) => {
      const S = sesionRef.current
      if (!S) return
      const dt = Math.min(0.25, (ahora - antes) / 1000)
      antes = ahora
      relojRef.current += dt * velRef.current
      let r = rRef.current
      while (r < S.D.n && completa(S.D, r, relojRef.current)) r++
      if (r !== rRef.current) avanzarA(r)
      else if (ahora - ultimoPintado > 250) {
        ultimoPintado = ahora
        setVista({ r, reloj: relojRef.current })
      }
      if (r >= S.D.n) {
        setJugando(false)
        setRevelada(true)
        return
      }
      raf = requestAnimationFrame(cuadro)
    }
    raf = requestAnimationFrame(cuadro)
    return () => cancelAnimationFrame(raf)
  }, [jugando])

  async function abrirDia(azar: boolean) {
    setAviso(null)
    setJugando(false)
    if (posRef.current) cerrar()
    setCargando(true)
    try {
      let dias: Dia[] = []
      let d = -1
      if (azar) {
        const desdeOk = meses.filter((x) => Number(x.m.slice(0, 4)) >= desde)
        // si los datos empiezan después (o terminan antes) del año elegido, se usa todo lo que hay
        const candidatos = desdeOk.length ? desdeOk : meses
        if (!candidatos.length) throw new Error('No hay meses con datos.')
        const total = candidatos.reduce((a, x) => a + x.velas, 0)
        let q = Math.random() * total
        let m = candidatos[candidatos.length - 1].m
        for (const x of candidatos) {
          q -= x.velas
          if (q < 0) {
            m = x.m
            break
          }
        }
        dias = await cargarMes(m)
        const validos = dias.map((D, i) => (D.pad || D.n < 50 ? -1 : i)).filter((i) => i >= 0)
        d = validos[Math.floor(Math.random() * validos.length)]
      } else {
        if (!fecha) throw new Error('Elige un día.')
        const objetivo = Number(fecha.replaceAll('-', ''))
        let m = fecha.slice(0, 7)
        for (let intento = 0; intento < 2 && d < 0; intento++) {
          if (!meses.some((x) => x.m === m)) break
          dias = await cargarMes(m)
          d = dias.findIndex((D) => !D.pad && D.fecha >= objetivo)
          if (d < 0) {
            const [y, mm] = m.split('-').map(Number)
            m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`
          }
        }
        if (d < 0) throw new Error('No tengo datos de ese día.')
        if (dias[d].fecha !== objetivo) setAviso(`Ese día no hubo mercado; te puse el ${fechaTexto(dias[d].fecha)}.`)
      }
      const D = dias[d]
      const P = d > 0 ? dias[d - 1] : null
      let reloj = 0
      if (inicio === 'ny') reloj = T_NY_PREVIA
      else if (inicio === 'hora') reloj = segundosDesdeReapertura(hora)
      else if (inicio === 'azar') reloj = Math.floor(Math.random() * T_FIN_SORTEO)
      const r = contar(D, reloj)
      const S = { D, P }
      sesionRef.current = S
      rRef.current = r
      relojRef.current = reloj
      baseRef.current = (r > 0 ? D.c[r - 1] : D.o[0]) * NQ.tick
      setRevelada(false)
      ciegasRef.current = ciegas
      graf.current?.cargar(P, D, r, NQ.tick)
      graf.current?.formato((p: number) => {
        if (!ciegasRef.current) return fmt(p, 2)
        const v = p - baseRef.current
        return `${v >= 0 ? '+' : ''}${fmt(v, 2)}`
      })
      graf.current?.marcar(marcasDelDia(jugadasRef.current, null, D))
      setSesion(S)
      setVista({ r, reloj })
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e))
    } finally {
      setCargando(false)
    }
  }

  function paso() {
    const S = sesionRef.current
    if (!S) return
    const j = rRef.current
    if (j >= S.D.n) return
    relojRef.current = Math.max(relojRef.current, j + 1 < S.D.n ? S.D.t[j + 1] : S.D.t[S.D.n - 1] + 60)
    avanzarA(j + 1)
  }

  const puedeOperar = () => {
    const S = sesionRef.current
    if (!S || posRef.current) return false
    const r = rRef.current
    return r < S.D.n && r < velaDeCierre(S.D)
  }

  function abrir(lado: 1 | -1) {
    const S = sesionRef.current
    if (!S || !puedeOperar()) return
    const e = rRef.current
    const st = Math.max(NQ.tick, Math.round(stopPts / NQ.tick) * NQ.tick)
    const ob = Math.max(NQ.tick, Math.round(objPts / NQ.tick) * NQ.tick)
    const c = Math.max(1, Math.min(50, Math.round(contratos)))
    const res = resolver(S.D, e, lado, st, ob, c, NQ)
    const contra = resolver(S.D, e, lado > 0 ? -1 : 1, st, ob, c, NQ)
    const p: Posicion = { lado, e, stopPts: st, objPts: ob, contratos: c, res, contra, hora: horaNY(S.D.t[e]) }
    posRef.current = p
    setPos(p)
    graf.current?.lineasPosicion(res.entrada, res.stop, res.obj)
  }

  function cerrar() {
    const S = sesionRef.current
    const p = posRef.current
    if (!S || !p) return
    const r = rRef.current
    if (r > p.res.js) return finalizar(p.res, p.contra)
    const res = resolver(S.D, p.e, p.lado, p.stopPts, p.objPts, p.contratos, NQ, r)
    const contra = resolver(S.D, p.e, p.lado > 0 ? -1 : 1, p.stopPts, p.objPts, p.contratos, NQ, r)
    finalizar(res, contra)
  }

  // atajos de teclado
  const acciones = useRef({ alternar: () => {}, paso, abrir, cerrar })
  acciones.current = {
    alternar: () => sesionRef.current && rRef.current < sesionRef.current.D.n && setJugando((x) => !x),
    paso,
    abrir,
    cerrar,
  }
  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return
      const a = acciones.current
      if (ev.code === 'Space') {
        ev.preventDefault()
        a.alternar()
      } else if (ev.code === 'ArrowRight') {
        ev.preventDefault()
        a.paso()
      } else if (ev.code === 'KeyC') a.abrir(1)
      else if (ev.code === 'KeyV') a.abrir(-1)
      else if (ev.code === 'KeyX') a.cerrar()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const S = sesion
  const oculto = ciegas && !revelada
  const anos = useMemo(() => [...new Set(meses.map((x) => Number(x.m.slice(0, 4))))], [meses])
  const primerMes = meses[0]?.m
  const ultimoMes = meses[meses.length - 1]?.m
  const ultimoDia = ultimoMes
    ? `${ultimoMes}-${String(new Date(Date.UTC(+ultimoMes.slice(0, 4), +ultimoMes.slice(5, 7), 0)).getUTCDate()).padStart(2, '0')}`
    : undefined

  // posición en vivo
  let vivo: { pts: number; usd: number; R: number } | null = null
  if (S && pos) {
    const r = vista.r
    const ultimo = r - 1 >= pos.e ? S.D.c[r - 1] * NQ.tick : pos.res.entrada
    const pts = (ultimo - pos.res.entrada) * pos.lado
    vivo = { pts, usd: pos.contratos * (pts * NQ.usd - NQ.com), R: (pts - NQ.com / NQ.usd) / pos.stopPts }
  }
  const resSesion = resumen(jugadas.map((j) => ({ R: j.res.R, usd: j.res.usd, contraR: j.contra.R })))
  const resTotal = resumen(historial)
  const riesgoUsd = Math.max(1, contratos) * (stopPts * NQ.usd + NQ.com)
  const fin = S ? vista.r >= S.D.n : false
  const despuesCierre = S ? vista.r >= velaDeCierre(S.D) : false
  const precio = (p: number) => (oculto ? signo(p - baseRef.current) : fmt(p))

  return (
    <section className="practica" aria-label="Práctica">
      <div className="p-barra">
        <div className="p-simbolo">
          <span className="p-ticker">{NQ.micro}</span>
          {WEB ? (
            <>
              <span className="p-demo" data-testid="demo">
                Datos de ejemplo
              </span>
              <span className="muted">Precios inventados; el NQ llega con las cuentas</span>
            </>
          ) : (
            <span className="muted">Micro Nasdaq 100</span>
          )}
        </div>
        <span className="p-sep" aria-hidden="true" />
        <label className="p-campo">
          <span>Día</span>
          <input
            type="date"
            value={fecha}
            min={primerMes ? `${primerMes}-01` : undefined}
            max={ultimoDia}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
          />
        </label>
        <label className="p-campo">
          <span>Empezar</span>
          <select value={inicio} onChange={(e) => setInicio(e.target.value as Inicio)}>
            <option value="reapertura">Reapertura 18:00</option>
            <option value="ny">Apertura NY 9:15</option>
            <option value="hora">A una hora</option>
            <option value="azar">Hora al azar</option>
          </select>
        </label>
        {inicio === 'hora' && (
          <label className="p-campo">
            <span>Hora ET</span>
            <input type="time" value={hora} onChange={(e) => e.target.value && setHora(e.target.value)} />
          </label>
        )}
        <label className="p-campo">
          <span>Azar desde</span>
          <select value={anos.includes(desde) ? desde : (anos[0] ?? desde)} onChange={(e) => setDesde(+e.target.value)}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="p-check">
          <input type="checkbox" checked={ciegas} onChange={(e) => setCiegas(e.target.checked)} />
          <span>A ciegas</span>
        </label>
        <div className="p-botones">
          <button type="button" className="btn ghost" disabled={cargando || !meses.length} onClick={() => abrirDia(false)}>
            Abrir día
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={cargando || !meses.length}
            onClick={() => abrirDia(true)}
            data-testid="azar"
          >
            Día al azar
          </button>
        </div>
      </div>

      <div className="p-cuerpo">
        <div className="p-area">
          <div className="p-graficas">
            <div className="p-g">
              <div className="p-leyenda">
                <strong>{NQ.micro}</strong> · 2500 vol
              </div>
              <div ref={elGrande} className="p-lienzo" />
            </div>
            <div className="p-g">
              <div className="p-leyenda">
                <strong>{NQ.micro}</strong> · 250 vol
              </div>
              <div ref={elChica} className="p-lienzo" />
            </div>
            {!S && (
              <div className="p-vacio">
                <strong>{cargando ? 'Cargando…' : 'Elige un día y dale "Abrir día", o prueba "Día al azar".'}</strong>
                <span className="muted">Atajos: Espacio play/pausa · → una vela · C comprar · V vender · X cerrar</span>
              </div>
            )}
          </div>

          <div className="p-replay">
            <button
              type="button"
              className="p-ico p-play"
              disabled={!S || fin}
              onClick={() => setJugando((x) => !x)}
              data-testid="play"
              aria-label={jugando ? 'Pausa' : 'Play'}
              title={jugando ? 'Pausa (Espacio)' : 'Play (Espacio)'}
            >
              {jugando ? <IconoPausa /> : <IconoPlay />}
            </button>
            <button
              type="button"
              className="p-ico"
              disabled={!S || fin}
              onClick={paso}
              data-testid="paso"
              aria-label="Siguiente vela"
              title="Siguiente vela (→)"
            >
              <IconoPaso />
            </button>
            <div className="p-vel" role="group" aria-label="Velocidad">
              {VELOCIDADES.map((v) => (
                <button
                  type="button"
                  key={v}
                  className={v === vel ? 'on' : ''}
                  onClick={() => setVel(v)}
                  aria-pressed={v === vel}
                >
                  {v}x
                </button>
              ))}
            </div>
            <div className="p-info" aria-live="polite">
              {S ? (
                <>
                  <span data-testid="dia" className="p-dia">
                    {oculto ? 'Día oculto' : `Sesión del ${fechaLarga(S.D.fecha)}`}
                  </span>
                  <span className="p-reloj">{horaNY(Math.floor(vista.reloj), true)} ET</span>
                  <span className="muted">
                    vela {vista.r} de {S.D.n}
                  </span>
                  {oculto && (
                    <button type="button" className="btn tiny" onClick={() => setRevelada(true)}>
                      Revelar día
                    </button>
                  )}
                </>
              ) : (
                <span className="muted">Sin sesión</span>
              )}
              {aviso && <span className="p-aviso">{aviso}</span>}
            </div>
          </div>
        </div>

        <aside className="p-lado">
          {pos ? (
            <div className="p-panel p-pos" data-testid="posicion">
              <div className="p-panel-tit">
                <span>Posición abierta</span>
                <span className={pos.lado > 0 ? 'up' : 'down'}>
                  {pos.lado > 0 ? 'Compra' : 'Venta'} {pos.contratos} {NQ.micro}
                </span>
              </div>
              {vivo && (
                <div className="p-pnl-bloque">
                  <span className={`p-pnl ${tono(vivo.usd)}`}>{signo(vivo.usd)} USD</span>
                  <span className="muted">
                    {signo(vivo.R)} R · {signo(vivo.pts)} pts
                  </span>
                </div>
              )}
              <dl className="p-datos">
                <div>
                  <dt>Entrada</dt>
                  <dd>{precio(pos.res.entrada)}</dd>
                </div>
                <div>
                  <dt>Stop</dt>
                  <dd className="down">{precio(pos.res.stop)}</dd>
                </div>
                <div>
                  <dt>Objetivo</dt>
                  <dd className="up">{precio(pos.res.obj)}</dd>
                </div>
              </dl>
              <button type="button" className="btn ghost ancho" onClick={cerrar} data-testid="cerrar">
                Cerrar posición <kbd>X</kbd>
              </button>
            </div>
          ) : (
            <div className="p-panel">
              <div className="p-panel-tit">
                <span>Orden a mercado</span>
                <span className="muted">entra en la vela siguiente</span>
              </div>
              <div className="p-lados">
                <button
                  type="button"
                  className="btn sell"
                  disabled={!S || fin || despuesCierre}
                  onClick={() => abrir(-1)}
                  data-testid="vender"
                >
                  Vender <kbd>V</kbd>
                </button>
                <button
                  type="button"
                  className="btn buy"
                  disabled={!S || fin || despuesCierre}
                  onClick={() => abrir(1)}
                  data-testid="comprar"
                >
                  Comprar <kbd>C</kbd>
                </button>
              </div>
              <div className="p-campos">
                <label>
                  <span>Contratos</span>
                  <input type="number" min={1} max={50} value={contratos} onChange={(e) => setContratos(+e.target.value || 1)} />
                </label>
                <label>
                  <span>Stop (pts)</span>
                  <input
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={stopPts}
                    onChange={(e) => setStopPts(+e.target.value || 1)}
                  />
                </label>
                <label>
                  <span>Objetivo (pts)</span>
                  <input type="number" min={0.25} step={0.25} value={objPts} onChange={(e) => setObjPts(+e.target.value || 1)} />
                </label>
              </div>
              <div className="p-riesgo muted">Riesgo {fmt(riesgoUsd)} USD con comisión</div>
            </div>
          )}

          <Marcador titulo="Esta sesión" r={resSesion} />
          <Marcador titulo="Todo el diario" r={resTotal} />

          <div className="p-panel p-lista">
            <div className="p-panel-tit">
              <span>Jugadas</span>
              <span className="muted">{jugadas.length}</span>
            </div>
            {jugadas.length > 0 ? (
              <table className="p-tabla" data-testid="jugadas">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Lado</th>
                    <th>Salida</th>
                    <th className="num">R</th>
                    <th className="num">Al revés</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadas.map((j) => (
                    <tr
                      key={j.id}
                      title={`${j.ciegas && oculto && S?.D.fecha === j.fecha ? 'día oculto' : fechaTexto(j.fecha)} · ${signo(j.res.usd)} USD`}
                    >
                      <td>{j.hora}</td>
                      <td className={j.res.lado > 0 ? 'up' : 'down'}>{j.res.lado > 0 ? 'Compra' : 'Venta'}</td>
                      <td className="muted">
                        {{ stop: 'stop', objetivo: 'objetivo', cierre: '16:10', manual: 'a mano' }[j.res.tipo]}
                      </td>
                      <td className={`num ${tono(j.res.R)}`}>{signo(j.res.R)}</td>
                      <td className="num muted">{signo(j.contra.R)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted p-nada">Todavía no hay jugadas.</p>
            )}
          </div>

          <p className="p-ayuda">
            "Al revés" es la misma jugada con el lado contrario: si a la larga te va igual, es volado. Simulador educativo; no es
            asesoría de inversión.
          </p>
        </aside>
      </div>
    </section>
  )
}

const IconoPlay = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
)
const IconoPausa = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" />
  </svg>
)
const IconoPaso = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M3 2.5v11l7-5.5z" fill="currentColor" />
    <path d="M11 2.5h2v11h-2z" fill="currentColor" />
  </svg>
)

function Marcador({ titulo, r }: { titulo: string; r: ReturnType<typeof resumen> }) {
  const ventaja = r.R - r.contraR
  return (
    <div className="p-panel p-score">
      <div className="p-panel-tit">
        <span>{titulo}</span>
        <span className="muted">{r.n} jugadas</span>
      </div>
      <div className="p-score-fila">
        <div>
          <span>Ganadas</span>
          <strong>{fmt(r.pct, 0)}%</strong>
        </div>
        <div>
          <span>Tú</span>
          <strong className={tono(r.R)}>{signo(r.R, 1)} R</strong>
        </div>
        <div>
          <span>Al revés</span>
          <strong>{signo(r.contraR, 1)} R</strong>
        </div>
        <div>
          <span>USD</span>
          <strong className={tono(r.usd)}>{signo(r.usd, 0)}</strong>
        </div>
      </div>
      {r.n > 0 && (
        <p className="p-score-nota">
          {r.n < 30
            ? 'Muy pocas jugadas para saber si es ventaja o suerte.'
            : ventaja > 0
              ? `Le vas ganando a la jugada al revés por ${fmt(ventaja, 1)} R.`
              : `La jugada al revés te va ganando por ${fmt(-ventaja, 1)} R.`}
        </p>
      )}
    </div>
  )
}
