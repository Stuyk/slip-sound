// Canvas helpers shared by the Slicer and Seamless Loop editors.
import type { PeakData } from './slicer'

export const RULER_H = 20

// Decoded audio plus its bucketed peaks, as the drawing helpers need it.
export interface WaveSource {
  sampleRate: number
  channels: Float32Array[]
  peaks: PeakData
}

export function formatTime(s: number, decimals = 3): string {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(decimals).padStart(decimals > 0 ? decimals + 3 : 2, '0')
  return `${m}:${sec}`
}

// Accepts "1.25" (seconds) or "0:01.250" (m:ss). Returns null if unparseable.
export function parseTimeInput(value: string): number | null {
  const v = value.trim()
  const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(v)
  const n = m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) : parseFloat(v)
  return isFinite(n) ? n : null
}

export function stemOf(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}

// Matches the canvas backing store to its wrapper's size at the current DPR.
export function sizeCanvas(
  c: HTMLCanvasElement | undefined,
  wrap: HTMLDivElement | undefined
): boolean {
  if (!c || !wrap) return false
  const rect = wrap.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const w = Math.floor(rect.width * dpr)
  const h = Math.floor(rect.height * dpr)
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
    return true
  }
  return false
}

// Min/max amplitude for the sample range [s0, s1), using bucketed peaks when zoomed out.
export function rangePeak(src: WaveSource, s0: number, s1: number): [number, number] {
  const { peaks, channels } = src
  let lo = 0
  let hi = 0
  if (s1 - s0 >= peaks.bucketSize * 2) {
    const b0 = Math.max(0, Math.floor(s0 / peaks.bucketSize))
    const b1 = Math.min(peaks.min.length, Math.ceil(s1 / peaks.bucketSize))
    for (let b = b0; b < b1; b++) {
      if (peaks.min[b] < lo) lo = peaks.min[b]
      if (peaks.max[b] > hi) hi = peaks.max[b]
    }
    return [lo, hi]
  }
  const end = Math.max(s0 + 1, s1)
  for (const ch of channels) {
    for (let i = Math.max(0, s0); i < end && i < ch.length; i++) {
      const v = ch[i]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  return [lo, hi]
}

// One min/max column per pixel for the time window [vs, ve].
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  src: WaveSource,
  width: number,
  top: number,
  height: number,
  vs: number,
  ve: number,
  colorAt: (t: number) => string
): void {
  const rate = src.sampleRate
  const mid = top + height / 2
  const amp = (height / 2) * 0.92
  const span = ve - vs
  for (let x = 0; x < width; x++) {
    const t0 = vs + (x / width) * span
    const t1 = vs + ((x + 1) / width) * span
    const [lo, hi] = rangePeak(src, Math.floor(t0 * rate), Math.floor(t1 * rate))
    const y1 = mid - hi * amp
    const y2 = mid - lo * amp
    ctx.fillStyle = colorAt(t0)
    ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1))
  }
}

function rulerStep(span: number, width: number): number {
  const steps = [
    0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600
  ]
  for (const s of steps) if ((s / span) * width >= 80) return s
  return steps[steps.length - 1]
}

// Time ruler along the top plus faint grid lines down the full height.
// `offset` shifts the labels (e.g. to show times relative to a loop start).
export function drawRuler(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vs: number,
  ve: number,
  offset = 0
): void {
  const span = ve - vs
  const xOf = (t: number): number => ((t - vs) / span) * width
  ctx.fillStyle = '#1a1b1e'
  ctx.fillRect(0, 0, width, RULER_H)
  const step = rulerStep(span, width)
  const decimals = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0
  ctx.strokeStyle = '#3a3d42'
  ctx.fillStyle = '#8b949e'
  ctx.font = '10px JetBrains Mono, monospace'
  ctx.textBaseline = 'middle'
  ctx.beginPath()
  for (let k = Math.ceil(vs / step); k * step <= ve; k++) {
    const t = k * step
    const x = Math.round(xOf(t)) + 0.5
    ctx.moveTo(x, RULER_H - 6)
    ctx.lineTo(x, height)
    ctx.fillText(formatTime(t - offset, decimals), x + 3, RULER_H / 2)
  }
  ctx.globalAlpha = 0.35
  ctx.stroke()
  ctx.globalAlpha = 1
}
