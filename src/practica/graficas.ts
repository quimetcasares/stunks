// Las dos gráficas de la práctica: velas de 2500 (grande) y de 250 (chica), con Lightweight Charts.
// Las velas usan un tiempo "de mentira" (1, 2, 3...) para que nunca se encimen; la hora real va en las etiquetas.
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { horaNY, type Dia } from './datos'

const C = {
  fondo: '#131722',
  texto: '#b2b5be',
  rejilla: '#1c202b',
  borde: '#2a2e39',
  cruz: '#758696',
  sube: '#089981',
  baja: '#f23645',
  entrada: '#b2b5be',
  stop: '#f23645',
  obj: '#089981',
  marca: '#ffc531',
}

interface Barra {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
}

export interface Marca {
  vela: number // índice de la vela de 250 del día
  tipo: 'entrada' | 'salida'
  lado: 1 | -1
  texto: string
}

class Panel {
  chart: IChartApi
  serie: ISeriesApi<'Candlestick'>
  marcas: ISeriesMarkersPluginApi<Time>
  etiquetas: string[] = []
  lineas: IPriceLine[] = []

  constructor(el: HTMLElement, formatoPrecio: (p: number) => string) {
    this.chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: C.fondo },
        textColor: C.texto,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
        fontSize: 11,
      },
      grid: { vertLines: { color: C.rejilla }, horzLines: { color: C.rejilla } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.cruz, labelBackgroundColor: '#2a2e39' },
        horzLine: { color: C.cruz, labelBackgroundColor: '#2a2e39' },
      },
      rightPriceScale: { borderColor: C.borde },
      timeScale: {
        borderColor: C.borde,
        rightOffset: 6,
        tickMarkFormatter: (t: Time) => this.etiquetas[(t as number) - 1] ?? '',
      },
      localization: {
        timeFormatter: (t: Time) => this.etiquetas[(t as number) - 1] ?? '',
        priceFormatter: formatoPrecio,
      },
    })
    this.serie = this.chart.addSeries(CandlestickSeries, {
      upColor: C.sube,
      downColor: C.baja,
      wickUpColor: C.sube,
      wickDownColor: C.baja,
      borderVisible: false,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    this.marcas = createSeriesMarkers(this.serie, [])
  }

  formato(f: (p: number) => string) {
    this.chart.applyOptions({ localization: { priceFormatter: f } })
  }

  ver(ultimas: number, total: number) {
    this.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, total - ultimas), to: total + 4 })
  }

  quitarLineas() {
    for (const l of this.lineas) this.serie.removePriceLine(l)
    this.lineas = []
  }

  linea(precio: number, color: string, titulo: string, punteada: boolean) {
    this.lineas.push(
      this.serie.createPriceLine({
        price: precio,
        color,
        lineWidth: 1,
        lineStyle: punteada ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: titulo,
      }),
    )
  }

  destruir() {
    this.chart.remove()
  }
}

export class Graficas {
  private grande: Panel
  private chica: Panel
  private P: Dia | null = null
  private D: Dia | null = null
  private tick = 0.25
  private r = 0
  // 250: barras del día anterior (completas) y del día (todas; se muestran hasta r)
  private b250P: Barra[] = []
  private b250D: Barra[] = []
  // 2500: barras del día anterior y las del día que ya se armaron
  private b2500P: Barra[] = []
  private b2500D: Barra[] = []
  private gActual = -1
  private grupoDeVela: number[] = [] // índice de la barra de 2500 (en tiempo de mentira) para cada vela de 250 del día

  constructor(elGrande: HTMLElement, elChica: HTMLElement, formatoPrecio: (p: number) => string) {
    this.grande = new Panel(elGrande, formatoPrecio)
    this.chica = new Panel(elChica, formatoPrecio)
  }

  formato(f: (p: number) => string) {
    this.grande.formato(f)
    this.chica.formato(f)
  }

  /** Carga un día nuevo y muestra las primeras r velas de 250. */
  cargar(P: Dia | null, D: Dia, r: number, tick: number) {
    this.P = P
    this.D = D
    this.tick = tick
    this.r = 0
    const T = tick
    const nP = P ? P.n : 0
    this.b250P = []
    this.chica.etiquetas = []
    if (P) {
      for (let j = 0; j < P.n; j++) {
        this.b250P.push({ time: (j + 1) as UTCTimestamp, open: P.o[j] * T, high: P.h[j] * T, low: P.l[j] * T, close: P.c[j] * T })
        this.chica.etiquetas.push(horaNY(P.t[j]))
      }
    }
    this.b250D = []
    for (let j = 0; j < D.n; j++) {
      this.b250D.push({ time: (nP + j + 1) as UTCTimestamp, open: D.o[j] * T, high: D.h[j] * T, low: D.l[j] * T, close: D.c[j] * T })
      this.chica.etiquetas.push(horaNY(D.t[j]))
    }

    // 2500 del día anterior, completas
    this.b2500P = []
    this.grande.etiquetas = []
    if (P) {
      let g = -1
      for (let j = 0; j < P.n; j++) {
        if (P.g[j] !== g) {
          g = P.g[j]
          this.b2500P.push({ time: (this.b2500P.length + 1) as UTCTimestamp, open: P.o[j] * T, high: P.h[j] * T, low: P.l[j] * T, close: P.c[j] * T })
          this.grande.etiquetas.push(horaNY(P.t[j]))
        } else {
          const b = this.b2500P[this.b2500P.length - 1]
          b.high = Math.max(b.high, P.h[j] * T)
          b.low = Math.min(b.low, P.l[j] * T)
          b.close = P.c[j] * T
        }
      }
    }
    // a qué barra de 2500 va cada vela del día
    this.grupoDeVela = []
    let g = -1
    let k = this.b2500P.length
    for (let j = 0; j < D.n; j++) {
      if (D.g[j] !== g) {
        g = D.g[j]
        k++
        this.grande.etiquetas.push(horaNY(D.t[j]))
      }
      this.grupoDeVela.push(k)
    }
    this.b2500D = []
    this.gActual = -1
    this.armar2500(r)
    this.r = r
    this.chica.serie.setData([...this.b250P, ...this.b250D.slice(0, r)])
    this.grande.serie.setData([...this.b2500P, ...this.b2500D])
    this.chica.ver(160, nP + r)
    this.grande.ver(110, this.b2500P.length + this.b2500D.length)
    this.marcar([])
    this.quitarLineas()
  }

  private armar2500(hasta: number) {
    const D = this.D!
    const T = this.tick
    for (let j = this.r; j < hasta; j++) {
      if (D.g[j] !== this.gActual) {
        this.gActual = D.g[j]
        this.b2500D.push({ time: this.grupoDeVela[j] as UTCTimestamp, open: D.o[j] * T, high: D.h[j] * T, low: D.l[j] * T, close: D.c[j] * T })
      } else {
        const b = this.b2500D[this.b2500D.length - 1]
        b.high = Math.max(b.high, D.h[j] * T)
        b.low = Math.min(b.low, D.l[j] * T)
        b.close = D.c[j] * T
      }
    }
  }

  /** Muestra hasta r velas de 250 del día (solo hacia adelante). */
  revelar(r: number) {
    if (!this.D || r <= this.r) return
    const antes = this.r
    const n2500 = this.b2500D.length
    this.armar2500(r)
    if (r - antes > 40) {
      this.chica.serie.setData([...this.b250P, ...this.b250D.slice(0, r)])
      this.grande.serie.setData([...this.b2500P, ...this.b2500D])
    } else {
      for (let j = antes; j < r; j++) this.chica.serie.update(this.b250D[j])
      for (let q = Math.max(0, n2500 - 1); q < this.b2500D.length; q++) this.grande.serie.update({ ...this.b2500D[q] })
    }
    this.r = r
  }

  marcar(marcas: Marca[]) {
    const nP = this.P ? this.P.n : 0
    const aMarca = (m: Marca, tiempo: number): SeriesMarker<Time> => ({
      time: tiempo as UTCTimestamp,
      position: m.tipo === 'entrada' ? (m.lado > 0 ? 'belowBar' : 'aboveBar') : m.lado > 0 ? 'aboveBar' : 'belowBar',
      color: m.tipo === 'entrada' ? C.marca : C.entrada,
      shape: m.tipo === 'entrada' ? (m.lado > 0 ? 'arrowUp' : 'arrowDown') : 'circle',
      text: m.texto,
    })
    const visibles = marcas.filter((m) => m.vela < this.r)
    const orden = (a: SeriesMarker<Time>, b: SeriesMarker<Time>) => (a.time as number) - (b.time as number)
    // la vela de la reapertura (18:00 ET), para ver dónde empieza el día
    const reapertura = (tiempo: number): SeriesMarker<Time>[] =>
      this.r > 0 ? [{ time: tiempo as UTCTimestamp, position: 'aboveBar', color: C.marca, shape: 'square', text: 'Reapertura' }] : []
    this.chica.marcas.setMarkers([...reapertura(nP + 1), ...visibles.map((m) => aMarca(m, nP + m.vela + 1))].sort(orden))
    this.grande.marcas.setMarkers(
      [
        ...reapertura(this.grupoDeVela[0]),
        ...visibles.filter((m) => this.grupoDeVela[m.vela] !== undefined).map((m) => aMarca(m, this.grupoDeVela[m.vela])),
      ].sort(orden),
    )
  }

  lineasPosicion(entrada: number, stop: number, obj: number) {
    this.quitarLineas()
    for (const p of [this.grande, this.chica]) {
      p.linea(entrada, C.entrada, 'entrada', false)
      p.linea(stop, C.stop, 'stop', true)
      p.linea(obj, C.obj, 'objetivo', true)
    }
  }

  quitarLineas() {
    this.grande.quitarLineas()
    this.chica.quitarLineas()
  }

  destruir() {
    this.grande.destruir()
    this.chica.destruir()
  }
}
