import type { Dipole, Vec3 } from './physics'

export type Channel = 'norm' | 'x' | 'y' | 'z'
export interface Pose { positionMm: Vec3; axis: Vec3 | null }
export interface SceneSettings {
  vectors: boolean
  lines: boolean
  slice: boolean
  arrayAxes: boolean
  magnetAxes: boolean
  sensorLabels: boolean
  vectorDensity: number
  sliceZ: number
  drag: boolean
}
export interface PlaygroundSettings {
  target: Dipole
  interferer: Dipole
  interference: boolean
  background: Vec3
  pitch: [number, number]
  rows: number
  cols: number
}
