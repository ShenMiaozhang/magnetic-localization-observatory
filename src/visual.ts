import { norm, type Vec3 } from './physics'
import type { Channel } from './types'

export const lineColors = ['#0072bd', '#d95319', '#edb120'] as const

// Independently interpolated scientific ramp, not an exact named colormap.
export const colorStops = [[53, 42, 135], [15, 92, 221], [18, 125, 216], [8, 158, 180], [47, 183, 144], [139, 202, 84], [249, 251, 14]] as const
export const scaleGradient = `linear-gradient(90deg, ${colorStops.map(c => `rgb(${c.join(',')})`).join(',')})`

export function component(v: Vec3 | null | undefined, channel: Channel): number | null {
  if (!v || v.length !== 3 || !v.every(Number.isFinite)) return null
  return channel === 'norm' ? norm(v) : v[{ x: 0, y: 1, z: 2 }[channel]]
}

export function colorFor(value: number | null, lo: number, hi: number): string {
  if (value === null || !Number.isFinite(value)) return '#dedede'
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1)))
  const i = Math.min(colorStops.length - 2, Math.floor(t * (colorStops.length - 1)))
  const u = t * (colorStops.length - 1) - i
  return `rgb(${colorStops[i].map((v, c) => Math.round(v + (colorStops[i + 1][c] - v) * u)).join(',')})`
}

export function valueRange(values: (number | null)[], signed = false): [number, number] {
  const max = values.reduce<number>((a, v) => v !== null && Number.isFinite(v) ? Math.max(a, Math.abs(v)) : a, 0) || 1
  return signed ? [-max, max] : [0, max]
}

export function format(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}
