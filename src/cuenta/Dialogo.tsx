import { type ReactNode, useEffect, useId, useRef } from 'react'
import { useI18n } from '../i18n'

/** Ventana encima de la app con <dialog>: Escape la cierra y el foco se queda adentro. */
export function Dialogo({
  abierto,
  alCerrar,
  titulo,
  children,
  testid,
}: {
  abierto: boolean
  alCerrar: () => void
  titulo: string
  children: ReactNode
  testid?: string
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    else if (!abierto && d.open) d.close()
  }, [abierto])

  return (
    <dialog ref={ref} className="dialogo" aria-labelledby={idTitulo} onClose={alCerrar} data-testid={testid}>
      <div className="dialogo-cab">
        <h2 id={idTitulo}>{titulo}</h2>
        <button type="button" className="dialogo-x" onClick={alCerrar} aria-label={t.c.cerrar}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {abierto && children}
    </dialog>
  )
}
