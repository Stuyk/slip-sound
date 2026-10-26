import { describe, expect, it } from 'vitest'
import { encodeWavFloat32, maxCrossfade, renderSeamlessLoop } from './seamlessLoop'

const RATE = 100

// src[i] = i, so every output sample says exactly which source sample it came from.
function ramp(n: number): Float32Array {
  return Float32Array.from({ length: n }, (_, i) => i)
}

describe('renderSeamlessLoop', () => {
  it('shortens the region by the crossfade length', () => {
    const [out] = renderSeamlessLoop([ramp(1000)], RATE, {
      start: 1,
      end: 5,
      crossfade: 0.5,
      curve: 'linear'
    })
    expect(out.length).toBe(400 - 50)
  })

  it('returns the raw region when there is no crossfade', () => {
    const [out] = renderSeamlessLoop([ramp(1000)], RATE, {
      start: 1,
      end: 2,
      crossfade: 0,
      curve: 'linear'
    })
    expect(Array.from(out)).toEqual(Array.from(ramp(1000).slice(100, 200)))
  })

  it('wraps from end to start along the original continuous audio', () => {
    const [out] = renderSeamlessLoop([ramp(1000)], RATE, {
      start: 1,
      end: 5,
      crossfade: 0.5,
      curve: 'linear'
    })
    // Tail starts at sample 450; the last output sample is the one just before it.
    expect(out[0]).toBe(450)
    expect(out[out.length - 1]).toBe(449)
    // After the fade the head plays untouched.
    expect(out[50]).toBe(150)
  })

  it('keeps a constant signal constant with a linear fade', () => {
    const dc = new Float32Array(1000).fill(0.5)
    const [out] = renderSeamlessLoop([dc], RATE, {
      start: 0,
      end: 10,
      crossfade: 2,
      curve: 'linear'
    })
    for (const v of out) expect(v).toBeCloseTo(0.5, 6)
  })

  it('uses equal-power gains (~0.707 each) at the crossfade midpoint', () => {
    const head = new Float32Array(400)
    head.fill(1, 0, 200) // head region is 1s, tail is 0s
    const [out] = renderSeamlessLoop([head], RATE, {
      start: 0,
      end: 4,
      crossfade: 2,
      curve: 'equal-power'
    })
    expect(out[100]).toBeCloseTo(Math.SQRT1_2, 2)
  })

  it('clamps the crossfade to half the region', () => {
    const [out] = renderSeamlessLoop([ramp(1000)], RATE, {
      start: 0,
      end: 2,
      crossfade: 5,
      curve: 'linear'
    })
    expect(out.length).toBe(100)
    expect(maxCrossfade(0, 2)).toBe(1)
  })

  it('renders every channel', () => {
    const out = renderSeamlessLoop([ramp(500), ramp(500)], RATE, {
      start: 0,
      end: 4,
      crossfade: 1,
      curve: 'linear'
    })
    expect(out).toHaveLength(2)
    expect(out[1].length).toBe(300)
  })
})

describe('encodeWavFloat32', () => {
  it('writes a float WAV header and interleaved samples', () => {
    const bytes = encodeWavFloat32(
      [new Float32Array([0.25, -0.5]), new Float32Array([1, 0])],
      48000
    )
    const view = new DataView(bytes.buffer)
    const text = (o: number, n: number): string => String.fromCharCode(...bytes.slice(o, o + n))
    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 4)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(3)
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(48000)
    expect(view.getUint32(40, true)).toBe(16)
    expect([0, 1, 2, 3].map((i) => view.getFloat32(44 + i * 4, true))).toEqual([0.25, 1, -0.5, 0])
    expect(bytes.length).toBe(44 + 16)
  })
})
