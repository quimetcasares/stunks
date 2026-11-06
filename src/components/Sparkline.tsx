import { useEffect, useRef } from 'react'

interface Props {
  line: { t: number; c: number }[]
  dayStart: number
  height?: number
}

// Gráfica chiquita del cierre por minuto. La gráfica de verdad (Lightweight Charts) llega en la fase 2.
export function Sparkline({ line, dayStart, height = 120 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx || line.length < 2) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const css = getComputedStyle(canvas)
      const up = css.getPropertyValue('--up').trim() || '#34d399'
      const down = css.getPropertyValue('--down').trim() || '#f87171'
      const grid = css.getPropertyValue('--grid').trim() || '#1c2533'
      const muted = css.getPropertyValue('--muted').trim() || '#8b98ab'

      let lo = Infinity
      let hi = -Infinity
      for (const pt of line) {
        if (pt.c < lo) lo = pt.c
        if (pt.c > hi) hi = pt.c
      }
      const pad = (hi - lo) * 0.08 || 1
      lo -= pad
      hi += pad
      const right = 64
      const x = (t: number) => ((t - dayStart) / 86_400_000) * (w - right)
      const y = (c: number) => h - ((c - lo) / (hi - lo)) * h

      // rejilla cada 6 horas
      ctx.strokeStyle = grid
      ctx.lineWidth = 1
      ctx.fillStyle = muted
      ctx.font = '11px system-ui, sans-serif'
      for (let hr = 0; hr <= 24; hr += 6) {
        const gx = Math.round(x(dayStart + hr * 3_600_000)) + 0.5
        ctx.beginPath()
        ctx.moveTo(gx, 0)
        ctx.lineTo(gx, h)
        ctx.stroke()
        if (hr < 24) ctx.fillText(`${String(hr).padStart(2, '0')}h`, gx + 4, h - 6)
      }

      const color = line[line.length - 1].c >= line[0].c ? up : down
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, `${color}40`)
      grad.addColorStop(1, `${color}00`)

      ctx.beginPath()
      line.forEach((pt, i) => {
        if (i) ctx.lineTo(x(pt.t), y(pt.c))
        else ctx.moveTo(x(pt.t), y(pt.c))
      })
      ctx.lineTo(x(line[line.length - 1].t), h)
      ctx.lineTo(x(line[0].t), h)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      ctx.beginPath()
      line.forEach((pt, i) => {
        if (i) ctx.lineTo(x(pt.t), y(pt.c))
        else ctx.moveTo(x(pt.t), y(pt.c))
      })
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.stroke()

      // máximo y mínimo a la derecha
      ctx.fillStyle = muted
      const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 0 : 2 })
      ctx.fillText(fmt(hi - pad), w - right + 8, y(hi - pad) + 4)
      ctx.fillText(fmt(lo + pad), w - right + 8, y(lo + pad) + 4)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [line, dayStart, height])

  return <canvas ref={ref} className="sparkline" style={{ height }} role="img" aria-label="Precio del día" />
}
