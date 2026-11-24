// Demo pública "Real or Stunks?" (/real-or-stunks): se ve una gráfica de 5 horas en velas de 5 minutos y se dice si es ETH
// real o de Stunks. Primero para cel: la gráfica arriba y dos botones grandes abajo. Sin registro ni apodo para jugar.
// La verdad solo llega del servidor después de contestar; esta página no la conoce antes.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorDemo, enviarPista, type Fuente, type Modo, type Pista, pedirRonda, type Ronda, responder } from './api'
import { Final, Marcador, useAgregado } from './Comunidad'
import { GraficaVelas } from './GraficaVelas'
import { T } from './textos'
import './demo.css'

type Vacio = 'sin-grupo' | 'sin-reto' | 'terminado' | 'agotado'
type Fase =
  | { t: 'cargando' }
  | { t: 'error'; codigo: string }
  | { t: 'vacio'; estado: Vacio }
  | { t: 'jugando'; r: Ronda; listoEn: number; enviando: boolean }
  | { t: 'resultado'; r: Ronda; acerto: boolean; era: Fuente; pista: Pista | 'enviada' | null }
  | { t: 'puntaje' }

const PISTAS: Pista[] = ['mechas', 'volumen', 'brincos', 'limpia', 'nose']

/** Fecha de hoy en Nueva York: el reto cambia a medianoche de allá. Solo sirve para guardar tus resultados de hoy. */
const hoyNY = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const claveReto = () => `stunks.demo.reto.${hoyNY()}`
const leerReto = (): boolean[] => {
  try {
    const x = JSON.parse(localStorage.getItem(claveReto()) ?? '[]')
    return Array.isArray(x) ? x.filter((b) => typeof b === 'boolean') : []
  } catch {
    return []
  }
}
const guardarReto = (r: boolean[]) => {
  try {
    localStorage.setItem(claveReto(), JSON.stringify(r))
  } catch {
    // Sin almacenamiento: el puntaje de hoy se pierde al recargar y ya.
  }
}

export default function RealOStunks() {
  const [modo, setModo] = useState<Modo>('reto')
  const [fase, setFase] = useState<Fase>({ t: 'cargando' })
  const [resultados, setResultados] = useState<boolean[]>([])
  const [ahora, setAhora] = useState(Date.now())
  const activo = useRef(true)
  const { a: agregado } = useAgregado(fase.t !== 'puntaje')

  useEffect(() => {
    document.title = `${T.title} · Stunks`
    document.documentElement.lang = 'en'
    activo.current = true
    return () => {
      activo.current = false
    }
  }, [])

  const cargar = useCallback(async (m: Modo) => {
    setFase({ t: 'cargando' })
    try {
      const x = await pedirRonda(m)
      if (!activo.current) return
      if (x.estado === 'ok') {
        setFase({ t: 'jugando', r: x, listoEn: Date.now() + Math.min(x.espera_ms, 1000), enviando: false })
      } else if (x.estado === 'terminado' && m === 'reto') {
        const hechos = leerReto()
        setResultados(hechos)
        setFase(hechos.length >= 10 ? { t: 'puntaje' } : { t: 'vacio', estado: 'terminado' })
      } else {
        setFase({ t: 'vacio', estado: x.estado })
      }
    } catch (e) {
      if (activo.current) setFase({ t: 'error', codigo: e instanceof ErrorDemo ? e.codigo : 'red' })
    }
  }, [])

  // La primera gráfica se pide al cargar la página, sin pantalla de bienvenida.
  useEffect(() => {
    setResultados(leerReto())
    void cargar('reto')
  }, [cargar])

  // El reloj corre solo mientras se espera el tiempo mínimo.
  const esperando = fase.t === 'jugando' && ahora < fase.listoEn
  useEffect(() => {
    if (!esperando) return
    const id = setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(id)
  }, [esperando])

  const contestar = async (dijo: Fuente) => {
    if (fase.t !== 'jugando' || fase.enviando || Date.now() < fase.listoEn) return
    const { r } = fase
    setFase({ ...fase, enviando: true })
    try {
      const x = await responder(r.ronda, dijo)
      const nuevos = [...resultados, x.acerto]
      setResultados(nuevos)
      if (r.modo === 'reto') guardarReto(nuevos)
      setFase({ t: 'resultado', r, acerto: x.acerto, era: x.era, pista: null })
    } catch (e) {
      if (e instanceof ErrorDemo && e.codigo === 'pronto') {
        setAhora(Date.now())
        setFase({ t: 'jugando', r, listoEn: Date.now() + (e.espera_ms ?? 1000) + 100, enviando: false })
      } else if (e instanceof ErrorDemo && e.codigo === 'ya') {
        void cargar(r.modo)
      } else {
        setFase({ t: 'error', codigo: e instanceof ErrorDemo ? e.codigo : 'red' })
      }
    }
  }

  const darPista = async (p: Pista) => {
    if (fase.t !== 'resultado' || fase.pista) return
    const { r } = fase
    setFase({ ...fase, pista: p })
    try {
      await enviarPista(r.ronda, p)
      setFase((f) => (f.t === 'resultado' && f.r.ronda === r.ronda ? { ...f, pista: 'enviada' } : f))
    } catch {
      // Es opcional: si no llega, no se le dice nada al jugador.
    }
  }

  const siguiente = () => {
    if (fase.t !== 'resultado') return
    if (fase.r.n >= fase.r.de) setFase({ t: 'puntaje' })
    else void cargar(fase.r.modo)
  }

  const jugarLibre = () => {
    setModo('libre')
    setResultados([])
    void cargar('libre')
  }

  const enJuego = fase.t === 'jugando' || fase.t === 'resultado'
  const rActual = fase.t === 'jugando' || fase.t === 'resultado' ? fase.r : null

  return (
    <div className="rs">
      <header className="rs-top">
        <a className="rs-marca" href="/">
          Stunks
        </a>
        <span className="rs-modo">{modo === 'reto' ? T.dailyChallenge : T.freePlay}</span>
      </header>

      <Marcador a={agregado} />

      <main className="rs-main">
        <h1 className="rs-titulo">{T.title}</h1>
        {enJuego && rActual ? (
          <>
            <p className="rs-prog" data-testid="rs-prog">
              {T.progress(rActual.n, rActual.de)}
            </p>
            <GraficaVelas velas={rActual.velas} />
          </>
        ) : (
          <p className="rs-sub">{T.tagline}</p>
        )}

        {fase.t === 'cargando' && <p className="rs-msg">{T.loading}</p>}

        {fase.t === 'error' && (
          <div className="rs-msg" role="alert">
            <p>{fase.codigo === 'limite' ? T.limit : fase.codigo === 'sin-servidor' ? T.noBackend : T.error}</p>
            <button type="button" className="rs-sec" onClick={() => void cargar(modo)}>
              {T.retry}
            </button>
          </div>
        )}

        {fase.t === 'vacio' && (
          <div className="rs-msg">
            <p>
              {fase.estado === 'sin-grupo'
                ? T.noGroup
                : fase.estado === 'sin-reto'
                  ? T.noChallenge
                  : fase.estado === 'terminado'
                    ? T.alreadyPlayed
                    : T.soldOut}
            </p>
            {fase.estado !== 'sin-grupo' && fase.estado !== 'agotado' && (
              <button type="button" className="rs-prim" onClick={jugarLibre}>
                {T.playMore}
              </button>
            )}
          </div>
        )}

        {fase.t === 'puntaje' && <Final resultados={resultados} esReto={modo === 'reto'} onMas={jugarLibre} />}
      </main>

      {fase.t === 'jugando' && (
        <div className="rs-botones" data-testid="rs-botones">
          <button
            type="button"
            className="rs-boton rs-real"
            disabled={esperando || fase.enviando}
            onClick={() => void contestar('real')}
            data-testid="rs-real"
          >
            {T.real}
          </button>
          <button
            type="button"
            className="rs-boton rs-stunks"
            disabled={esperando || fase.enviando}
            onClick={() => void contestar('stunks')}
            data-testid="rs-stunks"
          >
            {T.stunks}
          </button>
        </div>
      )}

      {fase.t === 'resultado' && (
        <div className={`rs-resultado ${fase.acerto ? 'bien' : 'mal'}`} role="status" data-testid="rs-resultado">
          <p className="rs-veredicto">{fase.acerto ? T.correct : T.wrong}</p>
          <p className="rs-era">{fase.era === 'real' ? T.wasReal : T.wasStunks}</p>
          <p className="rs-pregunta">{fase.pista === 'enviada' ? T.thanks : T.whatGaveItAway}</p>
          {fase.pista !== 'enviada' && (
            <div className="rs-pistas">
              {PISTAS.map((p) => (
                <button
                  type="button"
                  key={p}
                  className={`rs-chip${fase.pista === p ? ' on' : ''}`}
                  disabled={fase.pista !== null}
                  onClick={() => void darPista(p)}
                >
                  {T.hints[p]}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="rs-prim" onClick={siguiente} data-testid="rs-siguiente">
            {fase.r.n >= fase.r.de ? T.seeScore : T.next}
          </button>
        </div>
      )}

      <footer className="rs-pie">
        <p>{T.footer}</p>
        <p>{T.privacy}</p>
        <p>
          <a href="/privacidad">{T.privacyLink}</a> · <a href="/">{T.about}</a>
        </p>
      </footer>
    </div>
  )
}
