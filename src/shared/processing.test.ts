import { describe, expect, it } from 'vitest'
import {
  BUILTIN_PRESETS,
  DEFAULT_PROCESSING,
  type ProcessingSettings,
  buildPreGainFilters,
  canonicalPreGain,
  canonicalSettings,
  decideGain,
  describeEffects,
  isIdentity,
  matchesPreset,
  normalizeSettings,
  outputDuration,
  outputToSource,
  parseEbur128,
  sourceToOutput,
  summarize,
  timeMapping,
  withoutFades
} from './processing'

const s = (patch: Partial<ProcessingSettings>): ProcessingSettings => ({
  ...DEFAULT_PROCESSING,
  ...patch
})
const ctx = { inputDuration: 4, sampleRate: 48000, channels: 2, hasRubberband: true }

describe('isIdentity', () => {
  it('treats defaults and disabled racks as identity', () => {
    expect(isIdentity(DEFAULT_PROCESSING)).toBe(true)
    expect(isIdentity(s({ enabled: false, reverse: true }))).toBe(true)
    expect(isIdentity(null)).toBe(true)
  })

  it('treats any effect, or a normalize mode, as processing', () => {
    expect(isIdentity(s({ reverse: true }))).toBe(false)
    expect(isIdentity(s({ gainMode: 'peak' }))).toBe(false)
    expect(isIdentity(s({ fadeOut: 0.01 }))).toBe(false)
  })

  it('ignores values that round to neutral', () => {
    expect(isIdentity(s({ speed: 1.001, pitch: 0.001 }))).toBe(true)
  })
})

describe('buildPreGainFilters', () => {
  it('returns no filters for identity', () => {
    expect(buildPreGainFilters(DEFAULT_PROCESSING, ctx)).toEqual([])
  })

  it('runs stages in the fixed order: reverse, mono, speed, pitch, fades', () => {
    const f = buildPreGainFilters(
      s({ reverse: true, mono: true, speed: 2, pitch: 3, fadeIn: 0.1, fadeOut: 0.2 }),
      ctx
    )
    const idx = (prefix: string): number => f.findIndex((x) => x.startsWith(prefix))
    expect(idx('areverse')).toBe(0)
    expect(idx('pan=')).toBe(1)
    expect(idx('asetrate')).toBeLessThan(idx('rubberband=pitch'))
    expect(idx('rubberband=pitch')).toBeLessThan(idx('afade=t=in'))
    expect(idx('afade=t=in')).toBeLessThan(idx('afade=t=out'))
  })

  it('averages every channel when summing to mono', () => {
    expect(buildPreGainFilters(s({ mono: true }), { ...ctx, channels: 2 })).toEqual([
      'pan=mono|c0=0.5*c0+0.5*c1'
    ])
    expect(buildPreGainFilters(s({ mono: true }), { ...ctx, channels: 4 })[0]).toBe(
      'pan=mono|c0=0.25*c0+0.25*c1+0.25*c2+0.25*c3'
    )
    expect(buildPreGainFilters(s({ mono: true }), { ...ctx, channels: 1 })).toEqual([])
    expect(buildPreGainFilters(s({ mono: true }), { ...ctx, channels: null })).toEqual([
      'aformat=channel_layouts=mono'
    ])
  })

  it('varispeed resamples so pitch follows speed', () => {
    expect(buildPreGainFilters(s({ speed: 0.5 }), ctx)).toEqual([
      'asetrate=24000',
      'aresample=48000'
    ])
  })

  it('stretch keeps pitch, with an atempo chain when rubberband is missing', () => {
    expect(buildPreGainFilters(s({ speed: 0.25, speedMode: 'stretch' }), ctx)).toEqual([
      'apad=pad_dur=1',
      'rubberband=tempo=0.25:pitchq=quality',
      'atrim=end=16'
    ])
    expect(
      buildPreGainFilters(s({ speed: 0.25, speedMode: 'stretch' }), {
        ...ctx,
        hasRubberband: false
      })
    ).toEqual(['atempo=0.5', 'atempo=0.5'])
    expect(
      buildPreGainFilters(s({ speed: 4, speedMode: 'stretch' }), { ...ctx, hasRubberband: false })
    ).toEqual(['atempo=2', 'atempo=2'])
  })

  it('pads rubberband input and trims back to the exact length so tails survive', () => {
    expect(buildPreGainFilters(s({ pitch: 12, speed: 2, speedMode: 'stretch' }), ctx)).toEqual([
      'apad=pad_dur=1',
      'rubberband=tempo=2:pitchq=quality',
      'rubberband=pitch=2:pitchq=quality',
      'atrim=end=2'
    ])
  })

  it('falls back to resample + atempo for pitch without rubberband', () => {
    const f = buildPreGainFilters(s({ pitch: 12 }), { ...ctx, hasRubberband: false })
    expect(f).toEqual(['asetrate=96000', 'aresample=48000', 'atempo=0.5'])
  })

  it('places the fade-out against the post-speed duration and clamps long fades', () => {
    const f = buildPreGainFilters(s({ speed: 2, fadeOut: 0.5 }), ctx)
    expect(f).toContain('afade=t=out:st=1.5:d=0.5:curve=tri')
    const clamped = buildPreGainFilters(s({ fadeIn: 10 }), ctx)
    expect(clamped).toEqual(['afade=t=in:st=0:d=2:curve=tri'])
  })

  it('fades out through a reversed fade-in when the length is unknown', () => {
    expect(buildPreGainFilters(s({ fadeOut: 0.1 }), { ...ctx, inputDuration: NaN })).toEqual([
      'areverse',
      'afade=t=in:st=0:d=0.1:curve=tri',
      'areverse'
    ])
  })
})

describe('decideGain', () => {
  const m = { integrated: -30, samplePeak: -6, truePeak: -5.5 }

  it('passes plain gain through', () => {
    expect(decideGain(s({ gainDb: 3 }), null).gainDb).toBe(3)
  })

  it('peak-normalizes to the target', () => {
    expect(decideGain(s({ gainMode: 'peak', peakDb: -1 }), m).gainDb).toBe(5)
  })

  it('hits the LUFS target when the true peak allows it', () => {
    const d = decideGain(s({ gainMode: 'lufs', lufs: -32, truePeakDb: -1 }), m)
    expect(d).toEqual({ gainDb: -2, limitedByPeak: false, fellBackToPeak: false })
  })

  it('caps LUFS gain at the true-peak ceiling', () => {
    const d = decideGain(s({ gainMode: 'lufs', lufs: -14, truePeakDb: -1 }), m)
    expect(d).toEqual({ gainDb: 4.5, limitedByPeak: true, fellBackToPeak: false })
  })

  it('falls back to peak when loudness cannot be gated', () => {
    const d = decideGain(s({ gainMode: 'lufs' }), {
      integrated: -70,
      samplePeak: -10,
      truePeak: -9
    })
    expect(d.fellBackToPeak).toBe(true)
    expect(d.gainDb).toBe(8)
  })

  it('leaves silence alone', () => {
    expect(
      decideGain(s({ gainMode: 'peak' }), { integrated: null, samplePeak: null, truePeak: null })
        .gainDb
    ).toBe(0)
  })
})

describe('parseEbur128', () => {
  it('reads integrated loudness and peaks from the summary', () => {
    const out = `[Parsed_ebur128_0 @ 0x1] t: 1 ...
[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:         -23.4 LUFS
    Threshold: -33.6 LUFS

  Loudness range:
    LRA:         2.1 LU

  Sample peak:
    Peak:       -3.2 dBFS

  True peak:
    Peak:       -2.9 dBFS`
    expect(parseEbur128(out)).toEqual({ integrated: -23.4, samplePeak: -3.2, truePeak: -2.9 })
  })

  it('maps -inf to null', () => {
    expect(
      parseEbur128('Summary:\n I: -70.0 LUFS\n Sample peak:\n Peak: -inf dBFS').samplePeak
    ).toBeNull()
  })
})

describe('time mapping', () => {
  it('maps output time back to the source, reversed and sped up', () => {
    const m = timeMapping(s({ reverse: true, speed: 2 }), 1, 5)
    expect(outputToSource(0, m)).toBe(5)
    expect(outputToSource(1, m)).toBe(3)
    expect(sourceToOutput(3, m)).toBe(1)
  })

  it('is a plain offset for identity', () => {
    const m = timeMapping(DEFAULT_PROCESSING, 1, 5)
    expect(outputToSource(2, m)).toBe(3)
  })

  it('computes output duration from speed', () => {
    expect(outputDuration(s({ speed: 0.5 }), 4)).toBe(8)
    expect(outputDuration(s({ pitch: 5 }), 4)).toBe(4)
  })
})

describe('summaries and keys', () => {
  it('summarizes the chain as short tags', () => {
    expect(
      summarize(s({ reverse: true, pitch: -3, fadeOut: 0.2, gainMode: 'lufs', lufs: -16 }))
    ).toEqual(['rev', 'p-3', 'fo200', 'lufs-16'])
    expect(summarize(s({ speed: 0.5, speedMode: 'stretch' }))).toEqual(['str0.5'])
  })

  it('describes the chain in plain words', () => {
    expect(
      describeEffects(s({ reverse: true, pitch: -3, fadeOut: 0.04, gainMode: 'peak', peakDb: -1 }))
    ).toEqual(['Reversed', 'Pitch −3 semitones', 'Fade out 40 ms', 'Peak to −1 dB'])
    expect(describeEffects(s({ speed: 0.5, speedMode: 'stretch', gainDb: 3 }))).toEqual([
      'Speed 0.5× (pitch kept)',
      'Volume +3 dB'
    ])
    expect(describeEffects(s({}))).toEqual([])
  })

  it('gives every audible change a different key, and inaudible ones the same', () => {
    const base = s({ reverse: true })
    expect(canonicalSettings(base)).not.toBe(canonicalSettings(s({ reverse: true, pitch: 1 })))
    // speedMode doesn't matter at speed 1; fade curve doesn't matter without fades.
    expect(canonicalSettings(base)).toBe(
      canonicalSettings(s({ reverse: true, speedMode: 'stretch', fadeCurve: 'exp' }))
    )
    expect(canonicalSettings(s({ enabled: false, reverse: true }))).toBe('identity')
  })

  it('pre-gain key ignores the gain target', () => {
    expect(canonicalPreGain(s({ reverse: true, gainMode: 'lufs', lufs: -14 }))).toBe(
      canonicalPreGain(s({ reverse: true, gainMode: 'peak' }))
    )
  })

  it('strips fades for loops', () => {
    expect(withoutFades(s({ fadeIn: 1, fadeOut: 1 }))).toMatchObject({ fadeIn: 0, fadeOut: 0 })
  })

  it('clamps out-of-range values', () => {
    expect(normalizeSettings({ speed: 99, pitch: -99, lufs: 5 })).toMatchObject({
      speed: 4,
      pitch: -24,
      lufs: -8
    })
  })
})

describe('presets', () => {
  it('ships built-ins with unique ids that match their own settings', () => {
    const ids = new Set(BUILTIN_PRESETS.map((p) => p.id))
    expect(ids.size).toBe(BUILTIN_PRESETS.length)
    for (const p of BUILTIN_PRESETS) {
      expect(matchesPreset({ ...DEFAULT_PROCESSING, ...p.settings }, p)).toBe(true)
      expect(isIdentity({ ...DEFAULT_PROCESSING, ...p.settings })).toBe(false)
    }
  })

  it('stops matching once a control changes', () => {
    const p = BUILTIN_PRESETS[0]
    expect(matchesPreset({ ...DEFAULT_PROCESSING, ...p.settings, pitch: 2 }, p)).toBe(false)
  })
})
