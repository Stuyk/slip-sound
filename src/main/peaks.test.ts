import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
const { PeakAccumulator, inputSampleRate } = await import('./peaks')

function interleaved(
  frames: number,
  channels: number,
  at: (i: number, c: number) => number
): Buffer {
  const b = Buffer.alloc(frames * channels * 4)
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels; c++) b.writeFloatLE(at(i, c), (i * channels + c) * 4)
  return b
}

describe('PeakAccumulator', () => {
  it('takes the loudest channel and survives chunks split mid-frame', () => {
    // Left quiet, right loud in the second half.
    const data = interleaved(4096, 2, (i, c) => (c === 1 && i >= 2048 ? -0.8 : 0.1))
    const acc = new PeakAccumulator(2)
    for (let o = 0; o < data.length; o += 1001) acc.push(data.subarray(o, o + 1001))
    const peaks = acc.finish(4)
    expect(acc.frames).toBe(4096)
    expect(Array.from(peaks).map((v) => +v.toFixed(2))).toEqual([0.1, 0.1, 0.8, 0.8])
  })

  it('returns silence for empty input and handles fewer blocks than buckets', () => {
    expect(Array.from(new PeakAccumulator(1).finish(3))).toEqual([0, 0, 0])
    const acc = new PeakAccumulator(1)
    acc.push(interleaved(300, 1, () => 0.5))
    expect(Array.from(acc.finish(4))).toEqual([0.5, 0.5, 0.5, 0.5])
  })
})

describe('inputSampleRate', () => {
  it('reads the input stream rate, not the output one', () => {
    const stderr = [
      "Input #0, ogg, from 'a.ogg':",
      '  Stream #0:0: Audio: vorbis, 44100 Hz, stereo, fltp, 128 kb/s',
      'Output #0, f32le, to pipe:1:',
      '  Stream #0:0: Audio: pcm_f32le, 48000 Hz, stereo, flt'
    ].join('\n')
    expect(inputSampleRate(stderr)).toBe(44100)
    expect(inputSampleRate('nothing here')).toBeNull()
  })
})
