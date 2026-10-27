// Runs the real bundled ffmpeg over generated signals and checks the audio that comes out.
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import ffmpegPath from 'ffmpeg-static'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportRegion, getCapabilities, measureLoudness } from './export'
import { DEFAULT_PROCESSING, type ProcessingSettings } from '../shared/processing'

let dir: string
const RATE = 48000

function generate(name: string, expr: string, seconds: number): string {
  const out = join(dir, name)
  execFileSync(ffmpegPath as string, [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `aevalsrc='${expr}':d=${seconds}:s=${RATE}`,
    '-c:a',
    'pcm_f32le',
    out
  ])
  return out
}

interface Wav {
  channels: number
  rate: number
  bits: number
  data: Float32Array[]
}

// Reads the float or 24-bit WAVs ffmpeg writes (fmt chunk, then data chunk).
function readWav(path: string): Wav {
  const b = readFileSync(path)
  let pos = 12
  let channels = 0
  let rate = 0
  let bits = 0
  let fmt = 0
  while (pos < b.length) {
    const id = b.toString('ascii', pos, pos + 4)
    const size = b.readUInt32LE(pos + 4)
    const body = pos + 8
    if (id === 'fmt ') {
      fmt = b.readUInt16LE(body)
      channels = b.readUInt16LE(body + 2)
      rate = b.readUInt32LE(body + 4)
      bits = b.readUInt16LE(body + 14)
      if (fmt === 0xfffe) fmt = b.readUInt16LE(body + 24)
    } else if (id === 'data') {
      const bytes = bits / 8
      const frames = Math.floor(size / (bytes * channels))
      const data = Array.from({ length: channels }, () => new Float32Array(frames))
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) {
          const o = body + (i * channels + c) * bytes
          data[c][i] = fmt === 3 ? b.readFloatLE(o) : b.readIntLE(o, 3) / 8388608
        }
      }
      return { channels, rate, bits, data }
    }
    pos = body + size + (size % 2)
  }
  throw new Error('no data chunk')
}

const settings = (patch: Partial<ProcessingSettings>): ProcessingSettings => ({
  ...DEFAULT_PROCESSING,
  ...patch
})

async function render(
  source: string,
  patch: Partial<ProcessingSettings>,
  opts: { bitDepth?: 24 | 32 } = {}
): Promise<Wav> {
  const dest = join(dir, `out-${Math.random().toString(36).slice(2)}.wav`)
  await exportRegion({
    sourcePath: source,
    destPath: dest,
    format: 'wav',
    sampleRate: RATE,
    bitDepth: opts.bitDepth ?? 32,
    processing: settings(patch)
  })
  return readWav(dest)
}

const seconds = (w: Wav): number => w.data[0].length / w.rate
const peak = (x: Float32Array): number => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
const rms = (x: Float32Array): number => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
// Rising zero crossings per second ≈ frequency.
function frequency(x: Float32Array, rate: number): number {
  let n = 0
  for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) n++
  return n / (x.length / rate)
}

let tone: string
let swell: string
let stereo: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'slip-proc-test-'))
  tone = generate('tone.wav', '0.5*sin(2*PI*440*t)', 2)
  // Gets louder over time, so reversing is easy to detect.
  swell = generate('swell.wav', '0.45*t*sin(2*PI*440*t)', 2)
  stereo = generate('stereo.wav', '0.5*sin(2*PI*440*t)|0.5*sin(2*PI*440*t)', 2)
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('processing with real ffmpeg', () => {
  it('leaves audio untouched when nothing is enabled', async () => {
    const w = await render(tone, {})
    expect(seconds(w)).toBeCloseTo(2, 2)
    expect(peak(w.data[0])).toBeCloseTo(0.5, 2)
  })

  it('reverses: the loud end comes first', async () => {
    const w = await render(swell, { reverse: true })
    const tenth = Math.floor(w.data[0].length / 10)
    expect(rms(w.data[0].subarray(0, tenth))).toBeGreaterThan(rms(w.data[0].subarray(-tenth)) * 5)
  })

  it('varispeed 2x halves duration and doubles pitch', async () => {
    const w = await render(tone, { speed: 2 })
    expect(seconds(w)).toBeCloseTo(1, 1)
    expect(frequency(w.data[0], w.rate)).toBeCloseTo(880, -1)
  })

  it('stretch 2x halves duration and keeps pitch', async () => {
    const w = await render(tone, { speed: 2, speedMode: 'stretch' })
    expect(seconds(w)).toBeCloseTo(1, 1)
    expect(Math.abs(frequency(w.data[0], w.rate) - 440)).toBeLessThan(440 * 0.03)
  })

  it('pitch +12 doubles frequency and keeps duration', async () => {
    const w = await render(tone, { pitch: 12 })
    expect(Math.abs(seconds(w) - 2)).toBeLessThan(0.05)
    expect(Math.abs(frequency(w.data[0], w.rate) - 880)).toBeLessThan(880 * 0.03)
  })

  it('sums to one channel without clipping correlated stereo', async () => {
    const w = await render(stereo, { mono: true })
    expect(w.channels).toBe(1)
    expect(peak(w.data[0])).toBeCloseTo(0.5, 2)
  })

  it('fades both ends to silence and leaves the middle alone', async () => {
    const w = await render(tone, { fadeIn: 0.2, fadeOut: 0.2 })
    const x = w.data[0]
    expect(Math.abs(x[0])).toBeLessThan(0.01)
    expect(peak(x.subarray(-48))).toBeLessThan(0.01)
    expect(peak(x.subarray(x.length / 2 - 2400, x.length / 2 + 2400))).toBeCloseTo(0.5, 2)
  })

  it('applies plain gain', async () => {
    const w = await render(tone, { gainDb: -6 })
    expect(peak(w.data[0])).toBeCloseTo(0.5 * Math.pow(10, -6 / 20), 2)
  })

  it('peak-normalizes to the target', async () => {
    const w = await render(tone, { gainMode: 'peak', peakDb: -1 })
    expect(20 * Math.log10(peak(w.data[0]))).toBeCloseTo(-1, 1)
  })

  it('loudness-normalizes to the LUFS target', async () => {
    const dest = join(dir, 'lufs.wav')
    await exportRegion({
      sourcePath: tone,
      destPath: dest,
      format: 'wav',
      sampleRate: RATE,
      bitDepth: 32,
      processing: settings({ gainMode: 'lufs', lufs: -20, truePeakDb: -1 })
    })
    const m = await measureLoudness({ sourcePath: dest })
    expect(m.integrated).not.toBeNull()
    expect(Math.abs((m.integrated as number) + 20)).toBeLessThan(0.5)
  })

  it('processes only the trimmed region', async () => {
    const dest = join(dir, 'region.wav')
    await exportRegion({
      sourcePath: swell,
      destPath: dest,
      format: 'wav',
      sampleRate: RATE,
      bitDepth: 32,
      start: 0.5,
      end: 1.5,
      processing: settings({ speed: 0.5 })
    })
    expect(seconds(readWav(dest))).toBeCloseTo(2, 1)
  })

  it('writes real 24-bit files', async () => {
    const w = await render(tone, { reverse: true }, { bitDepth: 24 })
    expect(w.bits).toBe(24)
  })

  it('detects filters in the bundled ffmpeg', async () => {
    const caps = await getCapabilities()
    expect(caps.ebur128).toBe(true)
  })
})
