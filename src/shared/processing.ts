// Non-destructive processing chain shared by main (ffmpeg rendering) and the
// renderer (UI, summaries, playhead mapping). See specs/processing.md.

export type SpeedMode = 'varispeed' | 'stretch'
export type FadeCurve = 'linear' | 'exp' | 'log' | 'scurve'
export type GainMode = 'gain' | 'peak' | 'lufs'

export interface ProcessingSettings {
  // Master switch; false means "no processing" regardless of the other fields.
  enabled: boolean
  reverse: boolean
  // 0.25–4, 1 = off. Varispeed changes pitch with speed (tape); stretch keeps pitch.
  speed: number
  speedMode: SpeedMode
  // Semitones, -24..+24, duration preserved.
  pitch: number
  mono: boolean
  // Seconds.
  fadeIn: number
  fadeOut: number
  fadeCurve: FadeCurve
  gainMode: GainMode
  // Plain gain in dB (gain mode).
  gainDb: number
  // Target sample peak in dBFS (peak mode).
  peakDb: number
  // Target integrated loudness and true-peak ceiling (lufs mode).
  lufs: number
  truePeakDb: number
}

export type ProcessingEffects = Omit<ProcessingSettings, 'enabled'>

// The effect fields only (what a preset stores).
export function effectsOf(s: ProcessingSettings): ProcessingEffects {
  const copy: Partial<ProcessingSettings> = { ...s }
  delete copy.enabled
  return copy as ProcessingEffects
}

export const DEFAULT_PROCESSING: ProcessingSettings = {
  enabled: true,
  reverse: false,
  speed: 1,
  speedMode: 'varispeed',
  pitch: 0,
  mono: false,
  fadeIn: 0,
  fadeOut: 0,
  fadeCurve: 'linear',
  gainMode: 'gain',
  gainDb: 0,
  peakDb: -1,
  lufs: -16,
  truePeakDb: -1
}

export const LIMITS = {
  speed: { min: 0.25, max: 4 },
  pitch: { min: -24, max: 24 },
  fade: { min: 0, max: 30 },
  gainDb: { min: -24, max: 24 },
  peakDb: { min: -24, max: 0 },
  lufs: { min: -36, max: -8 },
  truePeakDb: { min: -9, max: 0 }
} as const

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0))
const round = (v: number, step: number): number => Math.round(v / step) * step

// Clamps and rounds every field so equal-sounding settings compare (and cache) equal.
export function normalizeSettings(s: Partial<ProcessingSettings>): ProcessingSettings {
  const m = { ...DEFAULT_PROCESSING, ...s }
  return {
    enabled: !!m.enabled,
    reverse: !!m.reverse,
    speed: round(clamp(m.speed, LIMITS.speed.min, LIMITS.speed.max), 0.01),
    speedMode: m.speedMode === 'stretch' ? 'stretch' : 'varispeed',
    pitch: round(clamp(m.pitch, LIMITS.pitch.min, LIMITS.pitch.max), 0.01),
    mono: !!m.mono,
    fadeIn: round(clamp(m.fadeIn, LIMITS.fade.min, LIMITS.fade.max), 0.001),
    fadeOut: round(clamp(m.fadeOut, LIMITS.fade.min, LIMITS.fade.max), 0.001),
    fadeCurve: (['linear', 'exp', 'log', 'scurve'] as const).includes(m.fadeCurve)
      ? m.fadeCurve
      : 'linear',
    gainMode: (['gain', 'peak', 'lufs'] as const).includes(m.gainMode) ? m.gainMode : 'gain',
    gainDb: round(clamp(m.gainDb, LIMITS.gainDb.min, LIMITS.gainDb.max), 0.1),
    peakDb: round(clamp(m.peakDb, LIMITS.peakDb.min, LIMITS.peakDb.max), 0.1),
    lufs: round(clamp(m.lufs, LIMITS.lufs.min, LIMITS.lufs.max), 0.1),
    truePeakDb: round(clamp(m.truePeakDb, LIMITS.truePeakDb.min, LIMITS.truePeakDb.max), 0.1)
  }
}

// True when the settings leave audio untouched, so callers can skip processing entirely.
export function isIdentity(s: ProcessingSettings | null | undefined): boolean {
  if (!s || !s.enabled) return true
  const n = normalizeSettings(s)
  return (
    !n.reverse &&
    n.speed === 1 &&
    n.pitch === 0 &&
    !n.mono &&
    n.fadeIn === 0 &&
    n.fadeOut === 0 &&
    n.gainMode === 'gain' &&
    n.gainDb === 0
  )
}

// Drops fades, e.g. for a seamless loop where a fade would break the join.
export function withoutFades(s: ProcessingSettings): ProcessingSettings {
  return { ...s, fadeIn: 0, fadeOut: 0 }
}

// Stable string for cache keys: only the fields that affect the audio, in a fixed order.
export function canonicalSettings(s: ProcessingSettings): string {
  if (isIdentity(s)) return 'identity'
  const n = normalizeSettings(s)
  const parts: Array<string | number | boolean> = [
    n.reverse,
    n.speed,
    n.speed === 1 ? '-' : n.speedMode,
    n.pitch,
    n.mono,
    n.fadeIn,
    n.fadeOut,
    n.fadeIn || n.fadeOut ? n.fadeCurve : '-',
    n.gainMode,
    n.gainMode === 'gain' ? n.gainDb : '-',
    n.gainMode === 'peak' ? n.peakDb : '-',
    n.gainMode === 'lufs' ? `${n.lufs}/${n.truePeakDb}` : '-'
  ]
  return parts.join('|')
}

// Same as canonicalSettings minus the gain stage: identifies what a loudness measurement ran on.
export function canonicalPreGain(s: ProcessingSettings): string {
  return canonicalSettings({ ...s, enabled: true, gainMode: 'gain', gainDb: 0 })
}

function fmt(n: number, digits = 2): string {
  return String(Number(n.toFixed(digits)))
}

// Short tags describing the chain, for chips and filename suffixes.
export function summarize(s: ProcessingSettings): string[] {
  if (isIdentity(s)) return []
  const n = normalizeSettings(s)
  const tags: string[] = []
  if (n.reverse) tags.push('rev')
  if (n.mono) tags.push('mono')
  if (n.speed !== 1) tags.push(`${n.speedMode === 'stretch' ? 'str' : 'x'}${fmt(n.speed)}`)
  if (n.pitch !== 0) tags.push(`p${n.pitch > 0 ? '+' : ''}${fmt(n.pitch)}`)
  if (n.fadeIn > 0) tags.push(`fi${Math.round(n.fadeIn * 1000)}`)
  if (n.fadeOut > 0) tags.push(`fo${Math.round(n.fadeOut * 1000)}`)
  if (n.gainMode === 'gain' && n.gainDb !== 0)
    tags.push(`g${n.gainDb > 0 ? '+' : ''}${fmt(n.gainDb, 1)}`)
  if (n.gainMode === 'peak') tags.push(`pk${fmt(n.peakDb, 1)}`)
  if (n.gainMode === 'lufs') tags.push(`lufs${fmt(n.lufs, 1)}`)
  return tags
}

// Plain-language description of the chain, for people rather than filenames.
export function describeEffects(s: ProcessingSettings): string[] {
  if (isIdentity(s)) return []
  const n = normalizeSettings(s)
  const sign = (v: number, digits = 1): string =>
    `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), digits)}`
  const out: string[] = []
  if (n.reverse) out.push('Reversed')
  if (n.mono) out.push('Mono')
  if (n.speed !== 1)
    out.push(`Speed ${fmt(n.speed)}×${n.speedMode === 'stretch' ? ' (pitch kept)' : ''}`)
  if (n.pitch !== 0) out.push(`Pitch ${sign(n.pitch, 2)} semitones`)
  if (n.fadeIn > 0) out.push(`Fade in ${Math.round(n.fadeIn * 1000)} ms`)
  if (n.fadeOut > 0) out.push(`Fade out ${Math.round(n.fadeOut * 1000)} ms`)
  if (n.gainMode === 'gain' && n.gainDb !== 0) out.push(`Volume ${sign(n.gainDb)} dB`)
  if (n.gainMode === 'peak') out.push(`Peak to ${sign(n.peakDb)} dB`)
  if (n.gainMode === 'lufs') out.push(`Loudness to ${sign(n.lufs)} LUFS`)
  return out
}

// Filename-safe suffix built from the summary tags, e.g. "rev_p-3_fo200".
export function suffixFor(s: ProcessingSettings): string {
  return summarize(s).join('_')
}

// Output length after processing (speed changes duration; pitch doesn't).
export function outputDuration(s: ProcessingSettings, sourceLength: number): number {
  if (isIdentity(s)) return sourceLength
  return sourceLength / normalizeSettings(s).speed
}

export interface TimeMapping {
  start: number
  end: number
  speed: number
  reverse: boolean
}

export function timeMapping(s: ProcessingSettings, start: number, end: number): TimeMapping {
  const n = normalizeSettings(s)
  const active = !isIdentity(s)
  return { start, end, speed: active ? n.speed : 1, reverse: active && n.reverse }
}

// Where in the source a given moment of the processed output came from.
export function outputToSource(t: number, m: TimeMapping): number {
  const offset = t * m.speed
  return m.reverse ? m.end - offset : m.start + offset
}

export function sourceToOutput(src: number, m: TimeMapping): number {
  const offset = m.reverse ? m.end - src : src - m.start
  return offset / m.speed
}

export interface ChainContext {
  // Length of the trimmed input in seconds.
  inputDuration: number
  // Source sample rate/channels if known (from the file header).
  sampleRate: number | null
  channels: number | null
  hasRubberband: boolean
}

const FADE_CURVES: Record<FadeCurve, string> = {
  linear: 'tri',
  exp: 'exp',
  log: 'log',
  scurve: 'hsin'
}

// atempo accepts 0.5–2 per instance; chain instances for anything outside that.
function atempoChain(factor: number): string[] {
  const out: string[] = []
  let f = factor
  while (f > 2) {
    out.push('atempo=2')
    f /= 2
  }
  while (f < 0.5) {
    out.push('atempo=0.5')
    f /= 0.5
  }
  if (Math.abs(f - 1) > 1e-6) out.push(`atempo=${fmt(f, 6)}`)
  return out
}

// ffmpeg filters for stages 1–5 (everything before gain). The gain stage is
// added by the caller once normalize targets have been measured.
export function buildPreGainFilters(s: ProcessingSettings, ctx: ChainContext): string[] {
  if (isIdentity(s)) return []
  const n = normalizeSettings(s)
  const filters: string[] = []
  const sr = ctx.sampleRate

  if (n.reverse) filters.push('areverse')

  if (n.mono && ctx.channels !== 1) {
    if (ctx.channels && ctx.channels > 1) {
      const w = fmt(1 / ctx.channels, 6)
      const terms = Array.from({ length: ctx.channels }, (_, i) => `${w}*c${i}`).join('+')
      filters.push(`pan=mono|c0=${terms}`)
    } else {
      filters.push('aformat=channel_layouts=mono')
    }
  }

  const pitchRatio = Math.pow(2, n.pitch / 12)
  if (n.speed !== 1) {
    if (n.speedMode === 'varispeed') {
      if (sr) filters.push(`asetrate=${Math.round(sr * n.speed)}`, `aresample=${sr}`)
      else if (ctx.hasRubberband)
        filters.push(`rubberband=tempo=${fmt(n.speed, 6)}:pitch=${fmt(n.speed, 6)}`)
      else filters.push(...atempoChain(n.speed))
    } else if (ctx.hasRubberband) {
      filters.push(`rubberband=tempo=${fmt(n.speed, 6)}:pitchq=quality`)
    } else {
      filters.push(...atempoChain(n.speed))
    }
  }

  if (n.pitch !== 0) {
    if (ctx.hasRubberband) {
      filters.push(`rubberband=pitch=${fmt(pitchRatio, 6)}:pitchq=quality`)
    } else if (sr) {
      // Resample up/down to shift pitch, then time-stretch back to the original length.
      filters.push(
        `asetrate=${Math.round(sr * pitchRatio)}`,
        `aresample=${sr}`,
        ...atempoChain(1 / pitchRatio)
      )
    }
  }

  const out = n.speed !== 1 ? ctx.inputDuration / n.speed : ctx.inputDuration
  const known = Number.isFinite(out) && out > 0

  // rubberband drops the last ~70 ms it still holds when input ends. Feed it
  // trailing silence, then trim back to the exact expected length.
  const firstRb = filters.findIndex((f) => f.startsWith('rubberband'))
  if (firstRb >= 0 && known) {
    const lastRb =
      filters.length - 1 - [...filters].reverse().findIndex((f) => f.startsWith('rubberband'))
    filters.splice(lastRb + 1, 0, `atrim=end=${fmt(out, 6)}`)
    filters.splice(firstRb, 0, 'apad=pad_dur=1')
  }
  const curve = FADE_CURVES[n.fadeCurve]
  const fadeIn = known ? Math.min(n.fadeIn, out / 2) : n.fadeIn
  const fadeOut = known ? Math.min(n.fadeOut, out / 2) : n.fadeOut
  if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fmt(fadeIn, 6)}:curve=${curve}`)
  if (fadeOut > 0) {
    if (known) {
      filters.push(`afade=t=out:st=${fmt(out - fadeOut, 6)}:d=${fmt(fadeOut, 6)}:curve=${curve}`)
    } else {
      // Unknown length (no readable header): fade in the reversed audio instead.
      filters.push('areverse', `afade=t=in:st=0:d=${fmt(fadeOut, 6)}:curve=${curve}`, 'areverse')
    }
  }

  return filters
}

export interface LoudnessMeasurement {
  // Integrated loudness in LUFS; null when the clip is too short/quiet to gate.
  integrated: number | null
  samplePeak: number | null
  truePeak: number | null
}

export interface GainDecision {
  gainDb: number
  // LUFS gain was reduced to respect the true-peak ceiling.
  limitedByPeak: boolean
  // LUFS was requested but the clip had no measurable loudness; peak mode was used.
  fellBackToPeak: boolean
}

// Turns gain settings plus a measurement into the single static gain to apply.
export function decideGain(s: ProcessingSettings, m: LoudnessMeasurement | null): GainDecision {
  const n = normalizeSettings(s)
  const none = { gainDb: 0, limitedByPeak: false, fellBackToPeak: false }
  if (n.gainMode === 'gain') return { ...none, gainDb: n.gainDb }
  if (!m || m.samplePeak === null) return none

  if (n.gainMode === 'peak') return { ...none, gainDb: round(n.peakDb - m.samplePeak, 0.01) }

  if (m.integrated === null || m.integrated <= -70) {
    return {
      gainDb: round(n.truePeakDb - (m.truePeak ?? m.samplePeak), 0.01),
      limitedByPeak: false,
      fellBackToPeak: true
    }
  }
  let gain = n.lufs - m.integrated
  let limited = false
  const peak = m.truePeak ?? m.samplePeak
  if (peak + gain > n.truePeakDb) {
    gain = n.truePeakDb - peak
    limited = true
  }
  return { gainDb: round(gain, 0.01), limitedByPeak: limited, fellBackToPeak: false }
}

// Parses the summary block printed by ffmpeg's ebur128 filter.
export function parseEbur128(stderr: string): LoudnessMeasurement {
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'))
  const num = (re: RegExp): number | null => {
    const match = re.exec(summary)
    if (!match) return null
    const v = parseFloat(match[1])
    return Number.isFinite(v) ? v : null
  }
  return {
    integrated: num(/I:\s+(-?[\d.]+|-inf)\s+LUFS/),
    samplePeak: num(/Sample peak:\s+Peak:\s+(-?[\d.]+|-inf)/),
    truePeak: num(/True peak:\s+Peak:\s+(-?[\d.]+|-inf)/)
  }
}

export interface ProcessingPreset {
  id: string
  name: string
  builtin?: boolean
  settings: ProcessingEffects
}

const preset = (id: string, name: string, s: Partial<ProcessingEffects>): ProcessingPreset => {
  return {
    id: `builtin:${id}`,
    name,
    builtin: true,
    settings: effectsOf(normalizeSettings({ ...DEFAULT_PROCESSING, ...s }))
  }
}

export const BUILTIN_PRESETS: ProcessingPreset[] = [
  preset('reverse-swell', 'Reverse Swell', { reverse: true, fadeOut: 0.04 }),
  preset('pitch-down-monster', 'Pitch Down Monster', { pitch: -7, gainMode: 'peak', peakDb: -1 }),
  preset('chipmunk', 'Chipmunk', { pitch: 7 }),
  preset('slow-mo', 'Slow-Mo', { speed: 0.5 }),
  preset('speed-up', 'Speed Up', { speed: 1.5 }),
  preset('dialog-mono', 'Dialog Mono', { mono: true, gainMode: 'peak', peakDb: -1 }),
  preset('streaming-loudness', 'Streaming −14 LUFS', {
    gainMode: 'lufs',
    lufs: -14,
    truePeakDb: -1
  }),
  preset('broadcast-loudness', 'Broadcast −23 LUFS', {
    gainMode: 'lufs',
    lufs: -23,
    truePeakDb: -1
  }),
  preset('clean-edges', 'Clean Edges (5 ms)', { fadeIn: 0.005, fadeOut: 0.005 })
]

// Effects fields of a preset equal the current rack (ignoring `enabled`)?
export function matchesPreset(s: ProcessingSettings, p: ProcessingPreset): boolean {
  const a = normalizeSettings({ ...s, enabled: true })
  const b = normalizeSettings({ ...p.settings, enabled: true })
  return (Object.keys(b) as Array<keyof ProcessingSettings>).every((k) => a[k] === b[k])
}
