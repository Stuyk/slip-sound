import { spawn } from 'child_process'
import { statSync } from 'fs'
import ffmpegPath from 'ffmpeg-static'
import { readAudioMeta } from './audioMeta'
import {
  type GainDecision,
  type LoudnessMeasurement,
  type ProcessingSettings,
  buildPreGainFilters,
  canonicalPreGain,
  decideGain,
  isIdentity,
  normalizeSettings,
  parseEbur128
} from '../shared/processing'

export type ExportFormat = 'wav' | 'ogg'
export type BitDepth = 16 | 24 | 32

export interface ExportParams {
  sourcePath: string
  destPath: string
  format: ExportFormat
  sampleRate: number
  bitDepth?: BitDepth
  oggQuality?: number // 0-10 (libvorbis VBR scale), default 5
  start?: number
  end?: number
  // Non-destructive processing chain; omitted or identity = plain trim/convert.
  processing?: ProcessingSettings
}

export interface ExportResult {
  measurement: LoudnessMeasurement | null
  gain: GainDecision | null
}

const WAV_CODECS: Record<BitDepth, string> = {
  16: 'pcm_s16le',
  24: 'pcm_s24le',
  32: 'pcm_f32le'
}

function trimArgs(start?: number, end?: number): string[] {
  const args: string[] = []
  if (start !== undefined) args.push('-ss', start.toFixed(3))
  if (end !== undefined) args.push('-to', end.toFixed(3))
  return args
}

// With a filter chain the trim has to happen inside it: -ss/-to after -i are
// output timestamps, which speed changes would otherwise shift.
function trimFilter(start?: number, end?: number): string[] {
  if (start === undefined && end === undefined) return []
  const bounds = [start !== undefined ? `start=${start.toFixed(6)}` : '', end !== undefined ? `end=${end.toFixed(6)}` : '']
  return [`atrim=${bounds.filter(Boolean).join(':')}`, 'asetpts=PTS-STARTPTS']
}

function buildArgs(params: ExportParams, filters: string[]): string[] {
  const { sourcePath, destPath, format, sampleRate, bitDepth = 16, oggQuality = 5, start, end } = params
  const args = ['-y', '-i', sourcePath]

  if (filters.length > 0) args.push('-af', [...trimFilter(start, end), ...filters].join(','))
  else args.push(...trimArgs(start, end))

  args.push('-ar', String(sampleRate))

  if (format === 'wav') {
    args.push('-c:a', WAV_CODECS[bitDepth] ?? WAV_CODECS[16])
  } else {
    args.push('-c:a', 'libvorbis', '-q:a', String(Math.min(10, Math.max(0, oggQuality))))
  }

  args.push(destPath)
  return args
}

export function getFfmpegPath(): string | null {
  if (!ffmpegPath) return null
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
}

// Runs ffmpeg and resolves with stdout + stderr (filters such as ebur128 report on stderr).
function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = getFfmpegPath()
    if (!bin) {
      reject(new Error('ffmpeg binary not found'))
      return
    }
    const proc = spawn(bin, args)
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout + stderr)
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
    })
  })
}

export interface FfmpegCapabilities {
  rubberband: boolean
  ebur128: boolean
}

let capabilities: Promise<FfmpegCapabilities> | null = null

// Probed once: the bundled ffmpeg builds differ per platform.
export function getCapabilities(): Promise<FfmpegCapabilities> {
  if (!capabilities) {
    capabilities = runFfmpeg(['-hide_banner', '-filters'])
      .then((out) => ({
        rubberband: /\srubberband\s/.test(out),
        ebur128: /\sebur128\s/.test(out)
      }))
      .catch(() => ({ rubberband: false, ebur128: false }))
  }
  return capabilities
}

interface ResolvedChain {
  filters: string[]
  measurement: LoudnessMeasurement | null
  gain: GainDecision | null
}

const measurements = new Map<string, LoudnessMeasurement>()

function measurementKey(params: ExportParams, settings: ProcessingSettings): string {
  let stamp = ''
  try {
    const st = statSync(params.sourcePath)
    stamp = `${st.mtimeMs}:${st.size}`
  } catch {
    // missing file: let ffmpeg report it
  }
  return [params.sourcePath, stamp, params.start ?? '', params.end ?? '', canonicalPreGain(settings)].join('|')
}

// Measures integrated loudness and peaks of the source after the pre-gain chain.
export async function measureLoudness(
  params: Pick<ExportParams, 'sourcePath' | 'start' | 'end' | 'processing'>
): Promise<LoudnessMeasurement> {
  const settings = normalizeSettings({ ...(params.processing ?? {}), enabled: true })
  const key = measurementKey(params as ExportParams, settings)
  const cached = measurements.get(key)
  if (cached) return cached
  const pre = await preGainFilters(params as ExportParams, settings)
  const stderr = await runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-i',
    params.sourcePath,
    '-af',
    [...trimFilter(params.start, params.end), ...pre, 'ebur128=peak=sample+true'].join(','),
    '-f',
    'null',
    '-'
  ])
  const m = parseEbur128(stderr)
  measurements.set(key, m)
  return m
}

async function preGainFilters(params: ExportParams, settings: ProcessingSettings): Promise<string[]> {
  const meta = readAudioMeta(params.sourcePath)
  const caps = await getCapabilities()
  const start = params.start ?? 0
  const end = params.end ?? meta.duration ?? NaN
  return buildPreGainFilters(settings, {
    inputDuration: end - start,
    sampleRate: meta.sampleRate,
    channels: meta.channels,
    hasRubberband: caps.rubberband
  })
}

async function resolveChain(params: ExportParams): Promise<ResolvedChain> {
  const settings = params.processing
  if (!settings || isIdentity(settings)) return { filters: [], measurement: null, gain: null }
  const filters = await preGainFilters(params, settings)
  let measurement: LoudnessMeasurement | null = null
  if (normalizeSettings(settings).gainMode !== 'gain') measurement = await measureLoudness(params)
  const gain = decideGain(settings, measurement)
  if (gain.gainDb !== 0) filters.push(`volume=${gain.gainDb}dB`)
  return { filters, measurement, gain }
}

export async function exportRegion(params: ExportParams): Promise<ExportResult> {
  const chain = await resolveChain(params)
  await runFfmpeg(buildArgs(params, chain.filters))
  return { measurement: chain.measurement, gain: chain.gain }
}

export type NamingMode = 'original' | 'numeric' | 'alpha'

// Base-26 alphabetic sequence: a, b, ..., z, aa, ab, ..., az, ba, ...
function toAlpha(index: number): string {
  let n = index
  let result = ''
  do {
    result = String.fromCharCode(97 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return result
}

export function generateExportFilename(
  originalStem: string,
  index: number,
  total: number,
  mode: NamingMode,
  baseName: string
): string {
  if (mode === 'original') return originalStem

  if (mode === 'numeric') {
    const width = total > 99 ? String(total).length : 2
    return `${baseName}_${String(index + 1).padStart(width, '0')}`
  }

  return `${baseName}_${toAlpha(index)}`
}

// Turns a user-supplied name into a safe filename stem: no path separators,
// no characters Windows rejects, no leading dots. Returns null if nothing usable is left.
export function sanitizeStem(name: string | undefined): string | null {
  if (!name) return null
  const cleaned = name
    // eslint-disable-next-line no-control-regex -- control chars are invalid in filenames
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
  return cleaned.length > 0 ? cleaned.slice(0, 200) : null
}
