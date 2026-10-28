import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import { useI18n } from './i18n'

export interface SignalSeries { label: string; color: string; values: (number | null)[] }
export default function SignalPlot({ x, series, xLabel, unit }: { x: number[]; series: SignalSeries[]; xLabel: string; unit: string }) {
  const { t } = useI18n()
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = container.current
    if (!element || !x.length) return
    const options: uPlot.Options = {
      width: Math.max(160, element.clientWidth), height: Math.max(90, element.clientHeight),
      pxAlign: 1, legend: { show: false },
      cursor: { drag: { x: false, y: false }, points: { show: true, size: 5 } },
      scales: { x: { time: false }, y: { auto: true } },
      axes: [
        { stroke: '#3f3f3f', font: '11px Arial', grid: { show: false }, size: 29, gap: 5, space: 34, ticks: { stroke: '#555', size: 4 }, values: (_u, values) => values.map(v => v.toFixed(0)) },
        { stroke: '#3f3f3f', font: '11px Arial', grid: { stroke: '#e3e3e3', width: 1 }, size: 46, gap: 5, ticks: { stroke: '#555', size: 4 }, values: (_u, values) => values.map(v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(Math.abs(v) < 10 ? 1 : 0)) },
      ],
      series: [{ label: t(xLabel) }, ...series.map(s => ({ label: t(s.label), stroke: s.color, width: 1.6, spanGaps: false, points: { show: true, size: 3 } }))],
    }
    const plot = new uPlot(options, [x, ...series.map(s => s.values)], element)
    const observer = new ResizeObserver(() => {
      if (element.clientWidth > 0) plot.setSize({ width: element.clientWidth, height: Math.max(90, element.clientHeight) })
    })
    observer.observe(element)
    return () => { observer.disconnect(); plot.destroy() }
  }, [x, series, xLabel, t])
  return <div className="signal-content">
    <div className="plot-units">{unit}</div>
    <div className="plot-canvas" ref={container} />
  </div>
}
