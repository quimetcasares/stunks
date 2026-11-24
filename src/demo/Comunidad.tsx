// Lo que se ve de los demás: el marcador en vivo (se consulta cada 15 s mientras la pestaña está a la vista) y, al terminar,
// tu lugar, el apodo, la tabla de líderes y la tarjeta para compartir.
import { useCallback, useEffect, useState } from 'react'
import { type Agregado, ErrorDemo, pedirAgregado, ponerApodo } from './api'
import { cuadritos, tarjetaPng, textoParaCompartir } from './tarjeta'
import { T } from './textos'

const CADA_MS = 15_000

export function useAgregado(activo = true) {
  const [a, setA] = useState<Agregado | null>(null)
  const recargar = useCallback(async () => {
    try {
      const x = await pedirAgregado()
      if (x?.comun && x.tu && Array.isArray(x.comun.tabla)) setA(x)
    } catch {
      // El marcador es un extra: si no llega, la página sigue igual.
    }
  }, [])
  useEffect(() => {
    if (!activo) return
    void recargar()
    const id = setInterval(() => {
      if (!document.hidden) void recargar()
    }, CADA_MS)
    return () => clearInterval(id)
  }, [activo, recargar])
  return { a, recargar }
}

const pct = (a: number, n: number) => (n > 0 ? `${((100 * a) / n).toFixed(1)}%` : '–')

export function Marcador({ a }: { a: Agregado | null }) {
  if (!a || a.comun.total === 0) return null
  return (
    <p className="rs-marcador" data-testid="rs-marcador">
      {T.everyone(pct(a.comun.aciertos, a.comun.total), a.comun.total.toLocaleString('en-US'))}
    </p>
  )
}

interface PropsFinal {
  resultados: boolean[]
  esReto: boolean
  /** Ranked de hoy todavía sin terminar en este navegador. */
  rankedPendiente: boolean
  onLibre: () => void
  onRanked: () => void
}

export function Final({ resultados, esReto, rankedPendiente, onLibre, onRanked }: PropsFinal) {
  const { a, recargar } = useAgregado(esReto)
  const [apodo, setApodo] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const numero = esReto ? (a?.tu.reto?.numero ?? null) : null
  const aciertos = resultados.filter(Boolean).length

  const guardar = async () => {
    setMsg(null)
    try {
      await ponerApodo(apodo.trim())
      setMsg(T.nickSaved(apodo.trim()))
      void recargar()
    } catch (e) {
      setMsg(T.nickErrors[e instanceof ErrorDemo ? e.codigo : ''] ?? T.error)
    }
  }

  const compartir = async () => {
    const texto = textoParaCompartir(resultados, numero)
    try {
      if (navigator.share) await navigator.share({ text: texto })
      else {
        await navigator.clipboard.writeText(texto)
        setCopiado(true)
      }
    } catch {
      // Cerró el menú de compartir: no pasa nada.
    }
  }

  const guardarImagen = async () => {
    const blob = await tarjetaPng(resultados, numero)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'real-or-stunks.png'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <section className="rs-puntaje" data-testid="rs-puntaje">
      <p className="rs-grande">{T.scoreTitle(aciertos, resultados.length)}</p>
      <p className="rs-cuadritos" aria-hidden="true">
        {cuadritos(resultados)}
      </p>
      {esReto && a?.tu.reto?.mejor_que != null && <p className="rs-sub">{T.beat(a.tu.reto.mejor_que)}</p>}
      <p className="rs-sub">{T.scoreLine}</p>

      {esReto ? (
        <>
          <div className="rs-compartir">
            <button type="button" className="rs-prim" onClick={() => void compartir()} data-testid="rs-compartir">
              {copiado ? T.copied : T.share}
            </button>
            <button type="button" className="rs-sec" onClick={() => void guardarImagen()}>
              {T.saveImage}
            </button>
          </div>

          <h2>{T.todayBoard}</h2>
          {a?.comun.tabla_hoy.length ? (
            <ol className="rs-tabla" data-testid="rs-tabla-hoy">
              {a.comun.tabla_hoy.slice(0, 10).map((f) => (
                <li key={f.apodo} className={f.apodo === a.tu.apodo ? 'yo' : ''}>
                  <span>{f.apodo}</span>
                  <span>
                    {f.aciertos}/10 · {f.segundos}s
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rs-sub">{T.todayBoardEmpty}</p>
          )}
          <p className="rs-sub">{T.todayBoardHelp}</p>

          {a && !a.tu.apodo && (
            <form
              className="rs-apodo"
              onSubmit={(e) => {
                e.preventDefault()
                void guardar()
              }}
            >
              <h3>{T.nickTitle}</h3>
              <p className="rs-sub">{T.nickHelp}</p>
              <input
                value={apodo}
                onChange={(e) => setApodo(e.target.value)}
                placeholder={T.nickPlaceholder}
                maxLength={16}
                aria-label={T.nickPlaceholder}
              />
              <button type="submit" className="rs-sec" disabled={apodo.trim().length < 3}>
                {T.nickSave}
              </button>
            </form>
          )}
          {msg && (
            <p className="rs-sub" role="status">
              {msg}
            </p>
          )}

          <h2>{T.allTimeBoard}</h2>
          {a?.comun.tabla.length ? (
            <ol className="rs-tabla" data-testid="rs-tabla">
              {a.comun.tabla.slice(0, 10).map((f) => (
                <li key={f.apodo} className={f.apodo === a.tu.apodo ? 'yo' : ''}>
                  <span>{f.apodo}</span>
                  <span>
                    {pct(f.aciertos, f.total)} · {f.total}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rs-sub">{T.leaderboardEmpty}</p>
          )}
          <p className="rs-sub">{T.allTimeHelp}</p>
          {a?.tu.lugar != null && <p className="rs-sub">{T.yourPlace(a.tu.lugar)}</p>}
        </>
      ) : (
        <p className="rs-sub" data-testid="rs-free-nota">
          {T.freeNote}
        </p>
      )}

      <h2>{T.honestTitle}</h2>
      <p className="rs-honesto">{T.honest}</p>
      {esReto ? (
        <button type="button" className="rs-prim" onClick={onLibre}>
          {T.playFree}
        </button>
      ) : (
        <>
          {rankedPendiente && (
            <button type="button" className="rs-prim" onClick={onRanked} data-testid="rs-ir-ranked">
              {T.playRanked}
            </button>
          )}
          <button type="button" className={rankedPendiente ? 'rs-sec' : 'rs-prim'} onClick={onLibre} data-testid="rs-otras-10">
            {T.another10}
          </button>
        </>
      )}
      {esReto && <p className="rs-sub">{T.comeBack}</p>}
    </section>
  )
}
