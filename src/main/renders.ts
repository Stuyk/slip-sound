// Processed/trimmed renders for preview and drag-out. One render per unique
// (source, region, chain, format) lives in the app cache; dragging copies it
// into the persistent, user-visible drag folder so NLE timelines never point
// at a temp file. See specs/processing.md §6.6 and §7.2.
import { app, shell } from 'electron'
import { createHash } from 'crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { cpus, homedir } from 'os'
import { basename, extname, join, resolve, sep } from 'path'
import { readAudioMeta } from './audioMeta'
import { exportRegion, sanitizeStem } from './export'
import { getDragBitDepth, getDragExportFolderPref } from './prefs'
import {
  type GainDecision,
  type LoudnessMeasurement,
  type ProcessingSettings,
  canonicalSettings,
  isIdentity,
  outputDuration,
  suffixFor,
  withoutFades
} from '../shared/processing'

export interface RenderRequest {
  sourcePath: string
  start?: number
  end?: number
  processing?: ProcessingSettings
  // Seamless loops: fades would break the join.
  excludeFades?: boolean
}

export interface RenderResult {
  // Cached render, playable and ready to be staged for drag.
  path: string
  key: string
  // Readable filename used when the render is copied into the drag folder.
  name: string
  duration: number | null
  measurement: LoudnessMeasurement | null
  gain: GainDecision | null
}

const CACHE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024
const AUDIO_EXTS = new Set(['.wav', '.ogg', '.flac', '.mp3', '.aif', '.aiff'])

export function cacheDir(): string {
  const dir = join(app.getPath('userData'), 'cache', 'renders')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function defaultDragFolder(): string {
  return join(homedir(), 'Slip Sound', 'Drag Exports')
}

// The configured folder, or the default when unset or unusable (e.g. an unplugged drive).
export function dragFolder(): { folder: string; isDefault: boolean; fellBack: boolean } {
  const pref = getDragExportFolderPref()
  if (pref) {
    try {
      mkdirSync(pref, { recursive: true })
      return { folder: pref, isDefault: false, fellBack: false }
    } catch {
      // fall through to the default
    }
  }
  const folder = defaultDragFolder()
  mkdirSync(folder, { recursive: true })
  return { folder, isDefault: true, fellBack: !!pref }
}

function effectiveSettings(req: RenderRequest): ProcessingSettings | undefined {
  if (!req.processing || isIdentity(req.processing)) return undefined
  return req.excludeFades ? withoutFades(req.processing) : req.processing
}

function renderKey(req: RenderRequest, bitDepth: number): string {
  let stamp = ''
  try {
    const st = statSync(req.sourcePath)
    stamp = `${st.mtimeMs}:${st.size}`
  } catch {
    // missing source: ffmpeg will report it
  }
  const settings = effectiveSettings(req)
  const parts = [
    req.sourcePath,
    stamp,
    req.start?.toFixed(4) ?? '',
    req.end?.toFixed(4) ?? '',
    settings ? canonicalSettings(settings) : 'identity',
    `wav${bitDepth}`
  ]
  return createHash('sha1').update(parts.join('\n')).digest('hex')
}

function regionLabel(req: RenderRequest): string {
  if (req.start === undefined && req.end === undefined) return ''
  return `_${(req.start ?? 0).toFixed(2)}-${req.end !== undefined ? req.end.toFixed(2) : 'end'}`
}

// e.g. "door_slam_1.20-2.85__rev_p-3_7f3a2c.wav": readable in an NLE bin, unique per render.
function displayName(req: RenderRequest, key: string): string {
  const stem = sanitizeStem(basename(req.sourcePath, extname(req.sourcePath))) ?? 'sound'
  const settings = effectiveSettings(req)
  const suffix = settings ? suffixFor(settings) : ''
  return `${stem}${regionLabel(req)}${suffix ? `__${suffix}` : ''}_${key.slice(0, 6)}.wav`
}

// Small concurrency gate so a big multi-select doesn't spawn 50 ffmpegs at once.
const maxParallel = Math.max(1, cpus().length - 1)
let running = 0
const waiting: Array<() => void> = []
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= maxParallel) await new Promise<void>((r) => waiting.push(r))
  running++
  try {
    return await fn()
  } finally {
    running--
    waiting.shift()?.()
  }
}

const inflight = new Map<string, Promise<RenderResult>>()

export function renderProcessed(req: RenderRequest): Promise<RenderResult> {
  const bitDepth = getDragBitDepth()
  const key = renderKey(req, bitDepth)
  const existing = inflight.get(key)
  if (existing) return existing

  const task = (async (): Promise<RenderResult> => {
    const dir = cacheDir()
    const path = join(dir, `${key}.wav`)
    const sidecar = join(dir, `${key}.json`)
    if (existsSync(path) && existsSync(sidecar)) {
      try {
        return { path, key, ...JSON.parse(readFileSync(sidecar, 'utf-8')) }
      } catch {
        // re-render below
      }
    }

    const meta = readAudioMeta(req.sourcePath)
    const settings = effectiveSettings(req)
    const partial = join(dir, `${key}.partial.wav`)
    const result = await withSlot(() =>
      exportRegion({
        sourcePath: req.sourcePath,
        destPath: partial,
        format: 'wav',
        sampleRate: meta.sampleRate ?? 48000,
        bitDepth,
        start: req.start,
        end: req.end,
        processing: settings
      })
    )
    renameSync(partial, path)

    const sourceLength = (req.end ?? meta.duration ?? NaN) - (req.start ?? 0)
    const info = {
      name: displayName(req, key),
      duration: Number.isFinite(sourceLength)
        ? settings
          ? outputDuration(settings, sourceLength)
          : sourceLength
        : null,
      measurement: result.measurement,
      gain: result.gain
    }
    writeFileSync(sidecar, JSON.stringify(info))
    return { path, key, ...info }
  })()

  inflight.set(key, task)
  task.finally(() => inflight.delete(key)).catch(() => {})
  return task
}

function isInside(child: string, parent: string): boolean {
  const c = resolve(child)
  const p = resolve(parent) + sep
  return c.startsWith(p)
}

// Copies cached renders into the drag folder (only the ones actually dragged).
export function stageForDrag(items: Array<{ path: string; name: string }>): string[] {
  const cache = cacheDir()
  const { folder } = dragFolder()
  return items.map((item) => {
    if (!isInside(item.path, cache)) throw new Error('Only cached renders can be staged for drag')
    const name = sanitizeStem(basename(item.name, '.wav')) ?? basename(item.path, '.wav')
    const dest = join(folder, `${name}.wav`)
    if (!existsSync(dest)) copyFileSync(item.path, dest)
    return dest
  })
}

export interface DragExportFile {
  path: string
  name: string
  size: number
  mtimeMs: number
}

export interface DragFolderInfo {
  folder: string
  isDefault: boolean
  fellBack: boolean
  bitDepth: 16 | 24 | 32
  count: number
  bytes: number
  recent: DragExportFile[]
}

function listAudio(folder: string): DragExportFile[] {
  let names: string[] = []
  try {
    names = readdirSync(folder)
  } catch {
    return []
  }
  const files: DragExportFile[] = []
  for (const name of names) {
    if (!AUDIO_EXTS.has(extname(name).toLowerCase())) continue
    try {
      const st = statSync(join(folder, name))
      if (st.isFile())
        files.push({ path: join(folder, name), name, size: st.size, mtimeMs: st.mtimeMs })
    } catch {
      // vanished between readdir and stat
    }
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

export function dragFolderInfo(limit = 15): DragFolderInfo {
  const { folder, isDefault, fellBack } = dragFolder()
  const files = listAudio(folder)
  return {
    folder,
    isDefault,
    fellBack,
    bitDepth: getDragBitDepth(),
    count: files.length,
    bytes: files.reduce((n, f) => n + f.size, 0),
    recent: files.slice(0, limit)
  }
}

// Moves the drag folder's audio files to the OS trash (recoverable), never auto-run.
export async function clearDragFolder(): Promise<number> {
  const { folder } = dragFolder()
  let n = 0
  for (const f of listAudio(folder)) {
    try {
      await shell.trashItem(f.path)
      n++
    } catch {
      // locked or already gone
    }
  }
  return n
}

// Keeps the render cache under its size cap, oldest first. Run at startup.
export function trimRenderCache(limit = CACHE_LIMIT_BYTES): void {
  const dir = cacheDir()
  const entries = readdirSync(dir)
    .filter((n) => n.endsWith('.wav'))
    .map((n) => {
      const p = join(dir, n)
      const st = statSync(p)
      return { p, size: st.size, t: st.atimeMs || st.mtimeMs }
    })
    .sort((a, b) => a.t - b.t)
  let total = entries.reduce((n, e) => n + e.size, 0)
  for (const e of entries) {
    if (total <= limit) break
    try {
      unlinkSync(e.p)
      const side = e.p.replace(/\.wav$/, '.json')
      if (existsSync(side)) unlinkSync(side)
      total -= e.size
    } catch {
      // in use; try the next
    }
  }
  // Leftovers from renders interrupted by a crash.
  for (const n of readdirSync(dir)) if (n.includes('.partial.')) unlinkSync(join(dir, n))
}
