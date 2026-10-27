// Waveform overviews for the main preview, made in the main process so the
// renderer never has to download and decode a whole (possibly huge) file.
// ffmpeg streams raw samples at the native rate (exact peaks, low memory), and
// results are cached on disk so revisiting a sound is instant.
import { app } from 'electron'
import { type ChildProcess, spawn } from 'child_process'
import { createHash } from 'crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getFfmpegPath } from './export'

export const PEAK_BUCKETS = 1000
// Frames per fine block while streaming; blocks are merged into buckets at the end.
const BLOCK = 256
const CACHE_LIMIT_BYTES = 100 * 1024 * 1024

export interface WaveformPeaks {
  // Max absolute amplitude (0..1) per bucket, across all channels.
  peaks: Float32Array
  // Seconds, when the sample rate is known.
  duration: number | null
}

// Collects per-block maxima from interleaved float32 chunks of any size.
export class PeakAccumulator {
  private blocks: number[] = []
  private current = 0
  private inBlock = 0
  private carry = Buffer.alloc(0)
  frames = 0

  constructor(private channels: number) {}

  push(chunk: Buffer): void {
    const buf = this.carry.length ? Buffer.concat([this.carry, chunk]) : chunk
    const ch = this.channels
    const usable = buf.length - (buf.length % (4 * ch))
    // Copy into an aligned buffer so samples can be read as a Float32Array.
    const bytes = new Uint8Array(usable)
    bytes.set(buf.subarray(0, usable))
    const samples = new Float32Array(bytes.buffer)
    for (let i = 0; i < samples.length; i += ch) {
      for (let c = 0; c < ch; c++) {
        const v = Math.abs(samples[i + c])
        if (v > this.current) this.current = v
      }
      this.frames++
      if (++this.inBlock === BLOCK) {
        this.blocks.push(this.current)
        this.current = 0
        this.inBlock = 0
      }
    }
    this.carry = Buffer.from(buf.subarray(usable))
  }

  finish(buckets: number): Float32Array {
    if (this.inBlock > 0) this.blocks.push(this.current)
    const out = new Float32Array(buckets)
    const n = this.blocks.length
    if (n === 0) return out
    for (let b = 0; b < buckets; b++) {
      const s = Math.floor((b * n) / buckets)
      const e = Math.max(s + 1, Math.floor(((b + 1) * n) / buckets))
      let m = 0
      for (let i = s; i < e && i < n; i++) if (this.blocks[i] > m) m = this.blocks[i]
      out[b] = Math.min(1, m)
    }
    return out
  }
}

function cacheDir(): string {
  const dir = join(app.getPath('userData'), 'cache', 'peaks')
  mkdirSync(dir, { recursive: true })
  return dir
}

function cacheKey(path: string): string | null {
  try {
    const st = statSync(path)
    return createHash('sha1')
      .update(`v2\0${path}\0${st.mtimeMs}\0${st.size}\0${PEAK_BUCKETS}`)
      .digest('hex')
  } catch {
    return null
  }
}

// Sample rate of the first audio stream, from ffmpeg's input summary, e.g.
// "Stream #0:0: Audio: vorbis, 44100 Hz, stereo, fltp".
export function inputSampleRate(stderr: string): number | null {
  const m = /Stream #\d+:\d+[^\n]*: Audio: [^\n]*?(\d+) Hz/.exec(stderr)
  return m ? parseInt(m[1], 10) : null
}

// The renderer only ever shows one sound; a new request cancels the old one so
// arrowing through a list of long files doesn't pile up decoders.
let active: { path: string; proc: ChildProcess; done: Promise<WaveformPeaks> } | null = null

export function getWaveformPeaks(path: string): Promise<WaveformPeaks> {
  const key = cacheKey(path)
  if (!key) return Promise.reject(new Error('File not found'))
  const file = join(cacheDir(), `${key}.bin`)
  try {
    const raw = readFileSync(file)
    const duration = raw.readDoubleLE(0)
    const peaks = new Float32Array(
      raw.buffer.slice(raw.byteOffset + 8, raw.byteOffset + raw.length)
    )
    return Promise.resolve({ peaks, duration: duration >= 0 ? duration : null })
  } catch {
    // not cached yet
  }

  if (active && active.path === path) return active.done
  if (active) active.proc.kill()

  const bin = getFfmpegPath()
  if (!bin) return Promise.reject(new Error('ffmpeg binary not found'))
  // Always two channels, so the frame layout never depends on header parsing
  // (mono is duplicated, surround is downmixed). The real sample rate comes from
  // ffmpeg's stream info rather than our header reader, which some files fool.
  const args = ['-hide_banner', '-v', 'info', '-i', path, '-map', '0:a:0', '-vn', '-ac', '2']
  args.push('-f', 'f32le', '-acodec', 'pcm_f32le', 'pipe:1')

  const proc = spawn(bin, args)
  const acc = new PeakAccumulator(2)
  let stderr = ''
  const done = new Promise<WaveformPeaks>((resolve, reject) => {
    proc.stdout.on('data', (d: Buffer) => acc.push(d))
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code, signal) => {
      if (active?.proc === proc) active = null
      if (signal) return reject(new Error('cancelled'))
      if (code !== 0) {
        const lines = stderr.trim().split('\n')
        const msg = lines.filter((l) => /error|invalid|no such/i.test(l)).pop() ?? lines.pop()
        return reject(new Error(msg || `ffmpeg exited ${code}`))
      }
      const peaks = acc.finish(PEAK_BUCKETS)
      const rate = inputSampleRate(stderr)
      const duration = rate ? acc.frames / rate : null
      try {
        const head = Buffer.alloc(8)
        head.writeDoubleLE(duration ?? -1, 0)
        writeFileSync(file, Buffer.concat([head, Buffer.from(peaks.buffer)]))
      } catch {
        // cache is best-effort
      }
      resolve({ peaks, duration })
    })
  })
  active = { path, proc, done }
  return done
}

// Oldest-first trim, run at startup.
export function trimPeaksCache(limit = CACHE_LIMIT_BYTES): void {
  const dir = cacheDir()
  const entries = readdirSync(dir).map((n) => {
    const p = join(dir, n)
    const st = statSync(p)
    return { p, size: st.size, t: st.atimeMs || st.mtimeMs }
  })
  entries.sort((a, b) => a.t - b.t)
  let total = entries.reduce((n, e) => n + e.size, 0)
  for (const e of entries) {
    if (total <= limit) break
    try {
      unlinkSync(e.p)
      total -= e.size
    } catch {
      // ignore
    }
  }
}
