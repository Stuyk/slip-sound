// Pure helpers for the Slicer: waveform peak data, silence-based auto
// slicing, and slice naming. Kept free of DOM/audio APIs so they're testable.

export interface Slice {
  id: number
  start: number
  end: number
  // User-entered output name; empty means "use the auto name".
  name: string
}

export interface SliceRange {
  start: number
  end: number
}

// Shortest slice the editor will create or keep, in seconds.
export const MIN_SLICE_SEC = 0.01

// Min/max per fixed-size bucket of samples, folded across channels. Drawing a
// zoomed-out view aggregates buckets instead of rescanning millions of
// samples every frame; zoomed-in views read raw samples instead.
export interface PeakData {
  bucketSize: number
  min: Float32Array
  max: Float32Array
}

export function buildPeaks(channels: Float32Array[], bucketSize = 256): PeakData {
  const length = channels.reduce((n, ch) => Math.max(n, ch.length), 0)
  const count = Math.max(1, Math.ceil(length / bucketSize))
  const min = new Float32Array(count)
  const max = new Float32Array(count)
  for (let b = 0; b < count; b++) {
    const from = b * bucketSize
    const to = Math.min(length, from + bucketSize)
    let lo = 0
    let hi = 0
    for (const ch of channels) {
      for (let i = from; i < to && i < ch.length; i++) {
        const v = ch[i]
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    min[b] = lo
    max[b] = hi
  }
  return { bucketSize, min, max }
}

export interface DetectOptions {
  // Anything quieter than this (peak, dBFS) counts as silence.
  thresholdDb: number
  // Silence must last at least this long to split two slices.
  minSilenceSec: number
  // Slices shorter than this are dropped.
  minSliceSec: number
  // Extra time kept before/after each detected sound so attacks and tails aren't clipped.
  padSec: number
}

export const DEFAULT_DETECT_OPTIONS: DetectOptions = {
  thresholdDb: -40,
  minSilenceSec: 0.15,
  minSliceSec: 0.05,
  padSec: 0.01
}

// Splits audio into regions separated by silence. Works on 5ms windows of
// peak amplitude across all channels.
export function detectSlices(
  channels: Float32Array[],
  sampleRate: number,
  opts: DetectOptions = DEFAULT_DETECT_OPTIONS
): SliceRange[] {
  const length = channels.reduce((n, ch) => Math.max(n, ch.length), 0)
  if (length === 0 || sampleRate <= 0) return []

  const threshold = Math.pow(10, opts.thresholdDb / 20)
  const windowSize = Math.max(1, Math.round(sampleRate * 0.005))
  const windowCount = Math.ceil(length / windowSize)
  const minSilenceWindows = Math.max(1, Math.round((opts.minSilenceSec * sampleRate) / windowSize))
  const duration = length / sampleRate

  const regions: SliceRange[] = []
  let openStart = -1
  let lastLoud = -1

  const close = (): void => {
    const start = Math.max(0, (openStart * windowSize) / sampleRate - opts.padSec)
    const end = Math.min(duration, ((lastLoud + 1) * windowSize) / sampleRate + opts.padSec)
    if (end - start >= opts.minSliceSec) regions.push({ start, end })
    openStart = -1
  }

  for (let w = 0; w < windowCount; w++) {
    const from = w * windowSize
    const to = Math.min(length, from + windowSize)
    let peak = 0
    for (const ch of channels) {
      for (let i = from; i < to && i < ch.length; i++) {
        const v = Math.abs(ch[i])
        if (v > peak) peak = v
      }
    }
    if (peak >= threshold) {
      if (openStart < 0) openStart = w
      lastLoud = w
    } else if (openStart >= 0 && w - lastLoud >= minSilenceWindows) {
      close()
    }
  }
  if (openStart >= 0) close()

  // Padding can make neighbours overlap when the gap is barely minSilence; split the difference.
  for (let i = 1; i < regions.length; i++) {
    if (regions[i].start < regions[i - 1].end) {
      const mid = (regions[i].start + regions[i - 1].end) / 2
      regions[i - 1].end = mid
      regions[i].start = mid
    }
  }
  return regions
}

// Default output name for the slice at `index` (0-based) of `total`.
export function autoSliceName(stem: string, index: number, total: number): string {
  const width = Math.max(2, String(total).length)
  return `${stem}_${String(index + 1).padStart(width, '0')}`
}

export function sortSlices(slices: Slice[]): Slice[] {
  return [...slices].sort((a, b) => a.start - b.start || a.end - b.end)
}

// Clamps a range into [0, duration] with start < end and a minimum length.
export function clampRange(start: number, end: number, duration: number): SliceRange {
  let s = Math.max(0, Math.min(start, end))
  let e = Math.min(duration, Math.max(start, end))
  if (e - s < MIN_SLICE_SEC) {
    e = Math.min(duration, s + MIN_SLICE_SEC)
    s = Math.max(0, e - MIN_SLICE_SEC)
  }
  return { start: s, end: e }
}
