import { describe, expect, it } from 'vitest'
import { colorFor, colorStops, component, format, lineColors, valueRange } from './visual'

describe('scientific display values', () => {
  it('keeps the familiar blue/orange/yellow channel cycle', () => expect(lineColors).toEqual(['#0072bd', '#d95319', '#edb120']))
  it('maps the same scalar to the same color in a shared range', () => {
    expect(colorFor(0, 0, 10)).toBe(`rgb(${colorStops[0].join(',')})`)
    expect(colorFor(10, 0, 10)).toBe(`rgb(${colorStops.at(-1)!.join(',')})`)
    expect(colorFor(20, 0, 10)).toBe(colorFor(10, 0, 10))
    expect(colorFor(-20, 0, 10)).toBe(colorFor(0, 0, 10))
    expect(colorFor(5, 0, 10)).toBe(colorFor(50, 0, 100))
  })
  it('preserves missing values and finite signed color limits', () => {
    expect(colorFor(null, 0, 1)).toBe('#dedede')
    expect(colorFor(NaN, 0, 1)).toBe('#dedede')
    expect(valueRange([null, -20, 5, NaN], true)).toEqual([-20, 20])
    expect(valueRange([null, null])).toEqual([0, 1])
    expect(format(null)).toBe('—')
  })
  it('keeps components, magnitude and signs distinct', () => {
    expect(component([3, -4, 0], 'norm')).toBe(5)
    expect(component([3, -4, 0], 'y')).toBe(-4)
    expect(component(null, 'x')).toBeNull()
  })
})
