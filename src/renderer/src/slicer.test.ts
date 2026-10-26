import { describe, expect, it } from 'vitest'
import { autoSliceName, buildPeaks, clampRange, detectSlices, sortSlices } from './slicer'

const RATE = 1000

// Builds a mono signal from [seconds, amplitude] segments.
function signal(segments: Array<[number, number]>): Float32Array {
  const total = segments.reduce((n, [sec]) => n + Math.round(sec * RATE), 0)
  const out = new Float32Array(total)
  let pos = 0
  for (const [sec, amp] of segments) {
    const n = Math.round(sec * RATE)
    for (let i = 0; i < n; i++) out[pos + i] = i % 2 === 0 ? amp : -amp
    pos += n
  }
  return out
}

const opts = { thresholdDb: -40, minSilenceSec: 0.1, minSliceSec: 0.05, padSec: 0 }

describe('detectSlices', () => {
  it('finds each sound separated by silence', () => {
    const data = signal([
      [0.2, 0],
      [0.3, 0.5],
      [0.4, 0],
      [0.2, 0.5],
      [0.3, 0]
    ])
    const slices = detectSlices([data], RATE, opts)
    expect(slices).toHaveLength(2)
    expect(slices[0].start).toBeCloseTo(0.2, 2)
    expect(slices[0].end).toBeCloseTo(0.5, 2)
    expect(slices[1].start).toBeCloseTo(0.9, 2)
    expect(slices[1].end).toBeCloseTo(1.1, 2)
  })

  it('does not split on gaps shorter than minSilenceSec', () => {
    const data = signal([
      [0.2, 0.5],
      [0.05, 0],
      [0.2, 0.5]
    ])
    expect(detectSlices([data], RATE, opts)).toHaveLength(1)
  })

  it('closes a slice that runs to the end of the file', () => {
    const data = signal([
      [0.2, 0],
      [0.3, 0.5]
    ])
    const slices = detectSlices([data], RATE, opts)
    expect(slices).toHaveLength(1)
    expect(slices[0].end).toBeCloseTo(0.5, 2)
  })

  it('drops blips shorter than minSliceSec', () => {
    const data = signal([
      [0.2, 0],
      [0.01, 0.5],
      [0.3, 0]
    ])
    expect(detectSlices([data], RATE, opts)).toHaveLength(0)
  })

  it('treats a sound on any channel as loud', () => {
    const left = signal([[0.5, 0]])
    const right = signal([
      [0.2, 0],
      [0.1, 0.5],
      [0.2, 0]
    ])
    expect(detectSlices([left, right], RATE, opts)).toHaveLength(1)
  })

  it('keeps padded neighbours from overlapping', () => {
    const data = signal([
      [0.2, 0.5],
      [0.1, 0],
      [0.2, 0.5]
    ])
    const slices = detectSlices([data], RATE, { ...opts, padSec: 0.08 })
    expect(slices).toHaveLength(2)
    expect(slices[0].end).toBeLessThanOrEqual(slices[1].start)
  })

  it('returns nothing for silence', () => {
    expect(detectSlices([signal([[1, 0]])], RATE, opts)).toEqual([])
  })
})

describe('buildPeaks', () => {
  it('folds min/max per bucket across channels', () => {
    const a = new Float32Array([0.1, -0.2, 0.3, 0])
    const b = new Float32Array([-0.5, 0, 0, 0.9])
    const peaks = buildPeaks([a, b], 2)
    expect(Array.from(peaks.min)).toEqual([expect.closeTo(-0.5), expect.closeTo(0)])
    expect(Array.from(peaks.max)).toEqual([expect.closeTo(0.1), expect.closeTo(0.9)])
  })
})

describe('autoSliceName', () => {
  it('zero-pads to at least two digits, more for big sets', () => {
    expect(autoSliceName('door', 0, 5)).toBe('door_01')
    expect(autoSliceName('door', 99, 150)).toBe('door_100')
    expect(autoSliceName('door', 0, 150)).toBe('door_001')
  })
})

describe('sortSlices', () => {
  it('orders by start time without mutating the input', () => {
    const input = [
      { id: 1, start: 2, end: 3, name: '' },
      { id: 2, start: 0, end: 1, name: '' }
    ]
    expect(sortSlices(input).map((s) => s.id)).toEqual([2, 1])
    expect(input[0].id).toBe(1)
  })
})

describe('clampRange', () => {
  it('orders and clamps into the file', () => {
    expect(clampRange(5, -1, 3)).toEqual({ start: 0, end: 3 })
  })

  it('enforces a minimum length, even at the end of the file', () => {
    const r = clampRange(3, 3, 3)
    expect(r.end - r.start).toBeCloseTo(0.01)
    expect(r.end).toBe(3)
  })
})
