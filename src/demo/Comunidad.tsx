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
      {a.comun.min_segundos > 0 && ` ${T.countRule(a.comun.min_segundos)}`}
    </p>
  )
}

export function Final({ resultados, esReto, onMas }: { resultados: boolean[]; esReto: boolean; onMas: () => void }) {
  const { a, recargar } = useAgregado()
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
      {a?.tu.reto?.mejor_que != null && esReto && <p className="rs-sub">{T.beat(a.tu.reto.mejor_que)}</p>}
      <p className="rs-sub">{T.scoreLine}</p>

      <div className="rs-compartir">
        <button type="button" className="rs-prim" onClick={() => void compartir()} data-testid="rs-compartir">
          {copiado ? T.copied : T.share}
        </button>
        <button type="button" className="rs-sec" onClick={() => void guardarImagen()}>
          {T.saveImage}
        </button>
      </div>

      <h2>{T.leaderboard}</h2>
      {a && a.comun.min_segundos > 0 && <p className="rs-sub">{T.countRule(a.comun.min_segundos)}</p>}
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
      {a?.tu.lugar != null && <p className="rs-sub">{T.yourPlace(a.tu.lugar)}</p>}

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

      <h2>{T.honestTitle}</h2>
      <p className="rs-honesto">{T.honest}</p>
      <button type="button" className="rs-prim" onClick={onMas}>
        {T.playMore}
      </button>
      {esReto && <p className="rs-sub">{T.comeBack}</p>}
    </section>
  )
}
