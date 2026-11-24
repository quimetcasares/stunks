// La gráfica de la demo: 60 velas, sin ejes, sin fechas, sin niveles de precio y sin cruz. Dibuja lo mismo para las dos
// fuentes: no sabe cuál es cuál. El tiempo es "de mentira" (1_000_000 + i * 300) y el volumen es relativo.
import { CandlestickSeries, ColorType, CrosshairMode, createChart, HistogramSeries, type UTCTimestamp } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import type { Velas } from './api'
import { T } from './textos'

const SUBE = '#089981'
const BAJA = '#f23645'

export function GraficaVelas({ velas }: { velas: Velas }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const c = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#131722' }, textColor: '#787b86', attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: '#1a1e29' } },
      crosshair: { mode: CrosshairMode.Hidden },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false, rightOffset: 1, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: false,
      handleScale: false,
    })
    const serie = c.addSeries(CandlestickSeries, {
      upColor: SUBE,
      downColor: BAJA,
      wickUpColor: SUBE,
      wickDownColor: BAJA,
      borderVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const vol = c.addSeries(HistogramSeries, { priceScaleId: '', priceLineVisible: false, lastValueVisible: false })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    const t = (i: number) => (1_000_000 + i * 300) as UTCTimestamp
    serie.setData(velas.o.map((o, i) => ({ time: t(i), open: o, high: velas.h[i], low: velas.l[i], close: velas.c[i] })))
    vol.setData(velas.v.map((v, i) => ({ time: t(i), value: v, color: velas.c[i] >= velas.o[i] ? `${SUBE}66` : `${BAJA}66` })))
    c.timeScale().fitContent()
    return () => c.remove()
  }, [velas])

  return <div ref={ref} className="rs-grafica" role="img" aria-label={T.chartLabel} data-testid="rs-grafica" />
}
