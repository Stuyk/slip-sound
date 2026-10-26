// Seamless loop rendering: crossfades the tail of a region into its head so
// the result can repeat with no click or jump at the wrap point.
//
// Region [a, b) of n samples, crossfade of c samples, output of n - c samples:
//   out[i]      = head[i] * fadeIn(i) + tail[i] * fadeOut(i)   for i < c
//   out[i]      = src[a + i]                                    for i >= c
// where head = src[a ..], tail = src[b - c ..]. At i = 0 the output is pure
// tail (src[b - c]), and the last output sample is src[b - c - 1], so
// wrapping from end to start is exactly the original, continuous audio. At
// i = c the fade is complete and the output continues as the untouched head.

export type CrossfadeCurve = 'equal-power' | 'linear'

export interface LoopSettings {
  start: number
  end: number
  crossfade: number
  curve: CrossfadeCurve
}

// The crossfade can use at most half the region (the tail and head mustn't overlap).
export function maxCrossfade(start: number, end: number): number {
  return Math.max(0, (end - start) / 2)
}

export function renderSeamlessLoop(
  channels: Float32Array[],
  sampleRate: number,
  settings: LoopSettings
): Float32Array[] {
  const length = channels.reduce((n, ch) => Math.max(n, ch.length), 0)
  const a = Math.max(0, Math.min(length, Math.round(settings.start * sampleRate)))
  const b = Math.max(a, Math.min(length, Math.round(settings.end * sampleRate)))
  const n = b - a
  const c = Math.max(0, Math.min(Math.floor(n / 2), Math.round(settings.crossfade * sampleRate)))
  const outLen = n - c

  const fadeIn = new Float32Array(c)
  const fadeOut = new Float32Array(c)
  for (let i = 0; i < c; i++) {
    const t = i / c
    if (settings.curve === 'linear') {
      fadeIn[i] = t
      fadeOut[i] = 1 - t
    } else {
      // Equal power keeps loudness steady when head and tail are unrelated (ambiences, noise).
      fadeIn[i] = Math.sin((t * Math.PI) / 2)
      fadeOut[i] = Math.cos((t * Math.PI) / 2)
    }
  }

  return channels.map((src) => {
    const out = new Float32Array(outLen)
    for (let i = 0; i < c; i++) {
      out[i] = (src[a + i] ?? 0) * fadeIn[i] + (src[b - c + i] ?? 0) * fadeOut[i]
    }
    for (let i = c; i < outLen; i++) out[i] = src[a + i] ?? 0
    return out
  })
}

// 32-bit float PCM WAV. The export step converts it to whatever format the user picks.
export function encodeWavFloat32(channels: Float32Array[], sampleRate: number): Uint8Array {
  const numCh = Math.max(1, channels.length)
  const frames = channels[0]?.length ?? 0
  const dataBytes = frames * numCh * 4
  const buf = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buf)
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 3, true) // WAVE_FORMAT_IEEE_FLOAT
  view.setUint16(22, numCh, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numCh * 4, true)
  view.setUint16(32, numCh * 4, true)
  view.setUint16(34, 32, true)
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = 44
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      view.setFloat32(offset, channels[ch]?.[i] ?? 0, true)
      offset += 4
    }
  }
  return new Uint8Array(buf)
}
