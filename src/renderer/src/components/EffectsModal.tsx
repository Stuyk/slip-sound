import {
  For,
  JSX,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  untrack
} from 'solid-js'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Scissors,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX
} from 'lucide-solid'
import type { RenderRequest, SoundRow } from '../../../preload/index'
import type { ExportFile } from './ExportModal'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { Kbd } from './ui/Kbd'
import { SegmentedControl } from './ui/SegmentedControl'
import { showToast } from './ui/Toast'
import { startRenderedDrag } from '../dragExports'
import { buildPeaks } from '../slicer'
import {
  RULER_H,
  type WaveSource,
  drawRuler,
  drawWaveform,
  formatTime,
  sizeCanvas,
  stemOf
} from '../waveformDraw'
import {
  activePreset,
  activePresetId,
  applyPreset,
  capabilities,
  clearActivePreset,
  presetModified,
  presets,
  rack,
  rackActive,
  resetRack,
  setPresets,
  updateRack
} from '../processingStore'
import {
  type FadeCurve,
  type GainDecision,
  type LoudnessMeasurement,
  type ProcessingSettings,
  type TimeMapping,
  DEFAULT_PROCESSING,
  LIMITS,
  describeEffects,
  effectsOf,
  sourceToOutput,
  outputToSource,
  suffixFor,
  timeMapping
} from '../../../shared/processing'

// Electron needs every dragged file on disk when the drag starts, so they're rendered ahead.
const MAX_DRAG = 50
const ORIGINAL_COLOR = 'rgba(255,255,255,0.55)'
const RESULT_COLOR = '#f5a524'

type Listen = 'effects' | 'original'

// One thing to process: a library sound, a slice of one (region), or a file made by
// another tool (virtual, e.g. a seamless loop), with an optional output name.
export interface EffectsItem {
  row: SoundRow
  region?: { start: number; end: number } | null
  name?: string
  // Seamless loop output: fades would break the loop join, so they're skipped.
  excludeFades?: boolean
  // Not a library file (a temp render); always dragged as a rendered copy.
  virtual?: boolean
}

// A SoundRow for a file that isn't in the library, so the tools can open it.
export function virtualRow(path: string, filename: string, duration: number | null): SoundRow {
  return {
    id: -1,
    path,
    filename,
    duration,
    channels: null,
    sample_rate: null,
    filesize: null,
    category: 'Uncategorized',
    subcategory: null,
    confidence: 0,
    matched_terms: [],
    favorite: false,
    category_manual: false
  }
}

export type SendTarget = 'slicer' | 'loop'

export interface EffectsModalProps {
  items: EffectsItem[]
  // What the items are, for labels: "sounds", "slices".
  noun?: string
  // True while another modal (export) sits on top; keys/close are ignored.
  blocked: boolean
  onClose: () => void
  onExport: (files: ExportFile[], processing: ProcessingSettings | undefined) => void
  // Open the processed result in another tool.
  onSendTo?: (target: SendTarget, row: SoundRow) => void
}

export default function EffectsModal(props: EffectsModalProps): JSX.Element {
  return (
    <Modal
      id="effects-modal"
      isOpen={props.items.length > 0}
      onClose={() => {
        if (!props.blocked) props.onClose()
      }}
      title={
        <div class="flex items-center gap-2.5 min-w-0">
          <span>Effects</span>
          <span class="normal-case tracking-normal font-normal text-[var(--text-muted)] truncate">
            {props.items.length === 1
              ? (props.items[0].name ?? props.items[0].row.filename)
              : `${props.items.length} ${props.noun ?? 'sounds'}`}
          </span>
        </div>
      }
      icon={<SlidersHorizontal size={16} />}
      width="1280px"
      bodyClass="p-0!"
    >
      <Show when={props.items.length > 0}>
        <EffectsEditor
          items={props.items}
          noun={props.noun ?? 'sounds'}
          blocked={props.blocked}
          onExport={props.onExport}
          onSendTo={props.onSendTo}
        />
      </Show>
    </Modal>
  )
}

const fmtDb = (v: number | null, unit = ' dB'): string =>
  v === null ? '–∞' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}${unit}`

function EffectsEditor(props: {
  items: EffectsItem[]
  noun: string
  blocked: boolean
  onExport: (files: ExportFile[], processing: ProcessingSettings | undefined) => void
  onSendTo?: (target: SendTarget, row: SoundRow) => void
}): JSX.Element {
  let origCanvas: HTMLCanvasElement | undefined
  let origWrap: HTMLDivElement | undefined
  let outCanvas: HTMLCanvasElement | undefined
  let outWrap: HTMLDivElement | undefined

  // ---- Which sound is being previewed (multi-selection: step through them) ----
  const [previewIdx, setPreviewIdx] = createSignal(0)
  const item = (): EffectsItem => props.items[Math.min(previewIdx(), props.items.length - 1)]
  const row = (): SoundRow => item().row
  const region = (): { start: number; end: number } | null => item().region ?? null
  const multi = (): boolean => props.items.length > 1
  const count = (): number => props.items.length
  const itemName = (it: EffectsItem): string => it.name ?? stemOf(it.row.filename)
  const renderRequest = (
    it: EffectsItem,
    processing: ProcessingSettings | undefined
  ): RenderRequest => ({
    sourcePath: it.row.path,
    start: it.region?.start,
    end: it.region?.end,
    processing,
    excludeFades: it.excludeFades
  })

  // ---- Audio ----
  let audioCtx: AudioContext | undefined
  let gainNode: GainNode | undefined
  const getCtx = (): AudioContext => {
    if (!audioCtx) {
      audioCtx = new AudioContext()
      gainNode = audioCtx.createGain()
      gainNode.connect(audioCtx.destination)
    }
    return audioCtx
  }

  interface Decoded {
    buffer: AudioBuffer
    wave: WaveSource
  }
  const decode = async (path: string): Promise<Decoded> => {
    const res = await fetch(window.api.audioUrl(path))
    const buffer = await getCtx().decodeAudioData(await res.arrayBuffer())
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i)
    )
    return {
      buffer,
      wave: { sampleRate: buffer.sampleRate, channels, peaks: buildPeaks(channels) }
    }
  }

  const [original, setOriginal] = createSignal<Decoded | null>(null)
  const [loadError, setLoadError] = createSignal<string | null>(null)
  createEffect(
    on(row, async (r) => {
      setOriginal(null)
      setLoadError(null)
      try {
        const d = await decode(r.path)
        if (r === row()) setOriginal(d)
      } catch (err) {
        if (r === row()) setLoadError(err instanceof Error ? err.message : String(err))
      }
    })
  )

  // Source span being processed: the region, or the whole sound.
  const span = (): { start: number; end: number } => {
    const o = original()
    const dur = o?.buffer.duration ?? row().duration ?? 0
    const r = region()
    return r ? { start: Math.max(0, r.start), end: Math.min(dur, r.end) } : { start: 0, end: dur }
  }

  // ---- Processed result for the previewed sound ----
  const [result, setResult] = createSignal<(Decoded & { forKey: string; path: string }) | null>(
    null
  )
  const [rendering, setRendering] = createSignal(false)
  const [renderError, setRenderError] = createSignal<string | null>(null)
  const [readout, setReadout] = createSignal<{
    m: LoudnessMeasurement | null
    gain: GainDecision | null
  } | null>(null)
  let renderTimer: ReturnType<typeof setTimeout> | undefined
  let renderToken = 0

  createEffect(() => {
    const it = item()
    const settings = rack()
    const active = rackActive()
    clearTimeout(renderTimer)
    const token = ++renderToken
    setRenderError(null)
    if (!active) {
      setResult(null)
      setRendering(false)
      return
    }
    setRendering(true)
    renderTimer = setTimeout(async () => {
      try {
        const res = await window.api.renderProcessed(renderRequest(it, settings))
        const d = await decode(res.path)
        if (token !== renderToken) return
        setResult({ ...d, forKey: res.key, path: res.path })
      } catch (err) {
        if (token !== renderToken) return
        setResult(null)
        setRenderError(err instanceof Error ? err.message.slice(0, 200) : String(err))
      } finally {
        if (token === renderToken) setRendering(false)
      }
    }, 200)
  })

  // Loudness of the sound after effects (before any level change), plus the level decision.
  let measureTimer: ReturnType<typeof setTimeout> | undefined
  let measureToken = 0
  createEffect(() => {
    const it = item()
    const settings = { ...rack(), enabled: true }
    clearTimeout(measureTimer)
    const token = ++measureToken
    if (!capabilities().ebur128) {
      setReadout(null)
      return
    }
    measureTimer = setTimeout(async () => {
      try {
        const res = await window.api.measureLoudness(renderRequest(it, settings))
        if (token === measureToken) setReadout({ m: res.measurement, gain: res.gain })
      } catch {
        if (token === measureToken) setReadout(null)
      }
    }, 300)
  })

  // ---- Playback: one shot, A/B between the original span and the processed result ----
  const [listen, setListen] = createSignal<Listen>('effects')
  const [playing, setPlaying] = createSignal(false)
  // Position in seconds from the start of what's being heard.
  const [pos, setPos] = createSignal(0)
  const [volume, setVolume] = createSignal(1)
  const [muted, setMuted] = createSignal(false)
  let source: AudioBufferSourceNode | undefined
  let startCtxTime = 0
  let startPos = 0
  let rafId: number | undefined

  createEffect(() => {
    const v = muted() ? 0 : volume()
    if (gainNode) gainNode.gain.value = v
  })

  // With no effects there's nothing different to hear, so "effects" plays the original.
  const hearing = (): Listen => (listen() === 'effects' && result() ? 'effects' : 'original')
  const lengthOf = (mode: Listen): number =>
    mode === 'effects' ? (result()?.buffer.duration ?? 0) : span().end - span().start
  const mapping = (): TimeMapping => timeMapping(rack(), span().start, span().end)

  function currentPos(): number {
    if (!audioCtx || !playing()) return pos()
    return Math.min(lengthOf(hearing()), startPos + audioCtx.currentTime - startCtxTime)
  }

  function stopSource(): void {
    if (source) {
      source.onended = null
      try {
        source.stop()
      } catch {
        // already stopped
      }
      source.disconnect()
      source = undefined
    }
    cancelAnimationFrame(rafId!)
  }

  function startPlayback(at: number): void {
    const o = original()
    if (!o) return
    const mode = hearing()
    const len = lengthOf(mode)
    if (len <= 0) return
    const from = at >= len - 0.005 ? 0 : Math.max(0, at)
    const ctx = getCtx()
    void ctx.resume()
    stopSource()
    const src = ctx.createBufferSource()
    src.connect(gainNode!)
    if (mode === 'effects') {
      src.buffer = result()!.buffer
      src.start(0, from)
    } else {
      src.buffer = o.buffer
      src.start(0, span().start + from, len - from)
    }
    src.onended = () => {
      if (source !== src) return
      stopSource()
      setPlaying(false)
      setPos(0)
    }
    source = src
    startCtxTime = ctx.currentTime
    startPos = from
    setPos(from)
    setPlaying(true)
    rafId = requestAnimationFrame(tick)
  }

  function tick(): void {
    if (!playing()) return
    setPos(currentPos())
    rafId = requestAnimationFrame(tick)
  }

  function stop(): void {
    if (playing()) setPos(currentPos())
    stopSource()
    setPlaying(false)
  }

  const togglePlay = (): void => (playing() ? stop() : startPlayback(pos()))

  // Convert a position between the original span and the result, so A/B keeps its place.
  function convert(p: number, from: Listen, to: Listen): number {
    if (from === to) return p
    const m = mapping()
    if (from === 'original') return sourceToOutput(span().start + p, m)
    return outputToSource(p, m) - span().start
  }

  function switchListen(next: Listen): void {
    if (next === listen()) return
    const before = hearing()
    const p = currentPos()
    setListen(next)
    const after = hearing()
    const q = Math.min(Math.max(0, convert(p, before, after)), lengthOf(after))
    if (playing()) startPlayback(q)
    else setPos(q)
  }

  // A new render arrives: keep playing at the same spot so tweaks are heard right away.
  createEffect(
    on(
      result,
      (r, prev) => {
        if (!untrack(playing)) {
          setPos(0)
          return
        }
        if (untrack(listen) === 'effects' && (r || prev)) startPlayback(untrack(currentPos))
      },
      { defer: true }
    )
  )

  // Switching to another sound stops playback.
  createEffect(on(row, () => stop(), { defer: true }))

  // ---- Drag-out: render every sound ahead so the drag can start instantly ----
  const [dragFiles, setDragFiles] = createSignal<Array<{ path: string; name: string }> | null>(null)
  const [dragDone, setDragDone] = createSignal(0)
  let dragTimer: ReturnType<typeof setTimeout> | undefined
  let dragToken = 0
  createEffect(() => {
    const items = props.items
    const settings = rack()
    const active = rackActive()
    clearTimeout(dragTimer)
    const token = ++dragToken
    setDragFiles(null)
    setDragDone(0)
    if (items.length > MAX_DRAG || rawDrag()) return
    dragTimer = setTimeout(async () => {
      const out: Array<{ path: string; name: string }> = []
      for (const it of items) {
        try {
          const res = await window.api.renderProcessed(
            renderRequest(it, active ? settings : undefined)
          )
          if (token !== dragToken) return
          out.push({ path: res.path, name: res.name })
        } catch {
          // a failed file is left out of the drag
        }
        if (token !== dragToken) return
        setDragDone(out.length)
      }
      setDragFiles(out)
    }, 400)
  })
  onCleanup(() => clearTimeout(dragTimer))

  // Whole library files with no effects drag as themselves; anything else is rendered.
  const rawDrag = (): boolean =>
    !rackActive() && props.items.every((it) => !it.region && !it.virtual)
  const dragReady = (): boolean => rawDrag() || (dragFiles()?.length ?? 0) > 0
  const dragLabel = (): string => {
    if (count() > MAX_DRAG) return `Drag is limited to ${MAX_DRAG} ${props.noun}`
    if (rawDrag()) return multi() ? `Drag ${count()} originals` : 'Drag original'
    if (!dragFiles()) return `Preparing ${dragDone()}/${count()}…`
    return multi()
      ? `Drag ${dragFiles()!.length} ${rackActive() ? 'processed' : props.noun}`
      : 'Drag result'
  }

  function onDragStart(e: DragEvent): void {
    e.preventDefault()
    if (rawDrag()) window.api.startDrag(props.items.map((it) => it.row.path))
    else if (dragFiles()?.length) startRenderedDrag(dragFiles()!)
  }

  // ---- Export ----
  function exportAll(): void {
    stop()
    props.onExport(
      props.items.map((it) => ({
        sourcePath: it.row.path,
        filename: it.row.filename,
        start: it.region?.start,
        end: it.region?.end,
        name: it.name,
        excludeFades: it.excludeFades
      })),
      rackActive() ? rack() : undefined
    )
  }

  // Hands the rendered result to the Slicer or Seamless Loop tool.
  function sendTo(target: SendTarget): void {
    const r = result()
    if (!r || !props.onSendTo) return
    stop()
    const tag = suffixFor(rack())
    props.onSendTo(
      target,
      virtualRow(r.path, `${itemName(item())}${tag ? `__${tag}` : ''}.wav`, r.buffer.duration)
    )
  }

  // ---- Drawing ----
  function drawOriginal(): void {
    if (!origCanvas) return
    sizeCanvas(origCanvas, origWrap)
    const ctx = origCanvas.getContext('2d')
    if (!ctx || origCanvas.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const width = origCanvas.width / dpr
    const height = origCanvas.height / dpr
    const { start, end } = span()
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)
    const o = original()
    if (o && end > start) {
      drawRuler(ctx, width, height, start, end, start)
      drawWaveform(ctx, o.wave, Math.floor(width), RULER_H, height - RULER_H, start, end, () =>
        hearing() === 'original' ? 'rgba(255,255,255,0.8)' : ORIGINAL_COLOR
      )
      drawPlayhead(ctx, 'original', width, height)
    }
    ctx.restore()
  }

  function drawResult(): void {
    if (!outCanvas) return
    sizeCanvas(outCanvas, outWrap)
    const ctx = outCanvas.getContext('2d')
    if (!ctx || outCanvas.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const width = outCanvas.width / dpr
    const height = outCanvas.height / dpr
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)
    const r = result()
    if (r && r.buffer.duration > 0) {
      const len = r.buffer.duration
      drawRuler(ctx, width, height, 0, len)
      drawWaveform(
        ctx,
        r.wave,
        Math.floor(width),
        RULER_H,
        height - RULER_H,
        0,
        len,
        () => RESULT_COLOR
      )
      drawPlayhead(ctx, 'effects', width, height)
    }
    ctx.restore()
  }

  // Solid playhead on the waveform being heard; a faint matching one on the other.
  function drawPlayhead(
    ctx: CanvasRenderingContext2D,
    lane: Listen,
    width: number,
    height: number
  ): void {
    const heard = hearing()
    if (!playing() && pos() === 0) return
    const len = lengthOf(lane)
    if (len <= 0) return
    const p = lane === heard ? pos() : convert(pos(), heard, lane)
    if (heard === 'original' && lane === 'effects' && !result()) return
    const x = Math.round((p / len) * width)
    if (x < 0 || x > width) return
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = lane === heard ? 1 : 0.35
    ctx.fillRect(x, 0, 1.5, height)
    ctx.globalAlpha = 1
  }

  createEffect(() => {
    original()
    result()
    pos()
    playing()
    listen()
    drawOriginal()
    drawResult()
  })

  // Click a waveform to hear that version from there.
  function seekFrom(lane: Listen, e: MouseEvent, wrap: HTMLDivElement | undefined): void {
    if (!wrap || e.button !== 0) return
    if (lane === 'effects' && !result()) return
    const rect = wrap.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setListen(lane)
    startPlayback(frac * lengthOf(lane))
  }

  // ---- Keyboard ----
  function onKeyDown(e: KeyboardEvent): void {
    if (props.blocked) return
    const active = document.activeElement
    const typing =
      (active?.tagName === 'INPUT' &&
        !['range', 'checkbox', 'radio', 'button'].includes((active as HTMLInputElement).type)) ||
      active?.tagName === 'TEXTAREA' ||
      active?.tagName === 'SELECT'
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      exportAll()
      return
    }
    if (typing) return
    if (e.code === 'Space') {
      e.preventDefault()
      togglePlay()
    } else if (e.key.toLowerCase() === 'b' && !mod) {
      e.preventDefault()
      switchListen(listen() === 'effects' ? 'original' : 'effects')
    } else if (multi() && e.key === 'ArrowLeft') {
      e.preventDefault()
      setPreviewIdx((i) => Math.max(0, i - 1))
    } else if (multi() && e.key === 'ArrowRight') {
      e.preventDefault()
      setPreviewIdx((i) => Math.min(count() - 1, i + 1))
    }
  }

  let resizeObserver: ResizeObserver | undefined
  onMount(() => {
    window.addEventListener('keydown', onKeyDown)
    resizeObserver = new ResizeObserver(() => {
      drawOriginal()
      drawResult()
    })
    if (origWrap) resizeObserver.observe(origWrap)
    if (outWrap) resizeObserver.observe(outWrap)
  })
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
    resizeObserver?.disconnect()
    clearTimeout(renderTimer)
    clearTimeout(measureTimer)
    stopSource()
    void audioCtx?.close()
  })

  const summary = createMemo(() => describeEffects(rack()))
  const exampleName = (): string => {
    const tag = rackActive() ? suffixFor(rack()) : ''
    return `${itemName(item())}${tag ? `__${tag}` : ''}.wav`
  }

  return (
    <div id="effects-editor" class="flex min-h-0 select-none" style={{ 'max-height': '86vh' }}>
      <PresetSidebar />

      <div class="flex-1 min-w-0 flex flex-col">
        {/* Toolbar: transport and A/B */}
        <div class="h-12 px-3.5 flex items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-panel-header)] shrink-0">
          <Button
            id="effects-play-btn"
            variant="primary"
            size="sm"
            onClick={togglePlay}
            disabled={!original()}
            icon={playing() ? <Pause size={14} /> : <Play size={14} />}
            title={playing() ? 'Stop (Space)' : 'Play (Space)'}
          >
            {playing() ? 'Stop' : 'Play'}
          </Button>
          <SegmentedControl
            id="effects-listen"
            value={listen()}
            onChange={(v) => switchListen(v as Listen)}
            items={[
              { id: 'effects', label: 'With effects' },
              { id: 'original', label: 'Original' }
            ]}
          />
          <span
            class="text-md text-[var(--text-muted)]"
            title="Switch between the two while playing"
          >
            <Kbd>B</Kbd>
          </span>
          <div class="flex items-center gap-1.5 px-2 h-8 rounded-[3px] bg-[#1e2022] border border-[#1c1d1f]">
            <IconButton
              size="xs"
              class="border-0! bg-transparent! shadow-none!"
              onClick={() => setMuted((m) => !m)}
              tooltip={muted() ? 'Unmute' : 'Mute'}
            >
              {muted() || volume() === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </IconButton>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted() ? 0 : volume()}
              onInput={(e) => {
                setVolume(parseFloat(e.currentTarget.value))
                if (muted()) setMuted(false)
              }}
              class="w-24 accent-[#007acc] h-2 cursor-pointer"
            />
          </div>
          <span class="font-mono text-md tabular-nums text-[var(--text-muted)] px-2">
            <span class="text-[var(--accent-color)]">{formatTime(pos())}</span> /{' '}
            {formatTime(lengthOf(hearing()))}
          </span>
          <div class="flex-1" />
          <Button
            id="effects-reset-all"
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={13} />}
            onClick={resetRack}
            disabled={!rackActive()}
            title="Turn every effect off"
          >
            Reset all
          </Button>
          <Show when={multi()}>
            <div class="flex items-center gap-1 text-md text-[var(--text-muted)]">
              <IconButton
                size="sm"
                onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
                disabled={previewIdx() === 0}
                tooltip="Previous sound (←)"
              >
                <ChevronLeft size={14} />
              </IconButton>
              <span class="tabular-nums whitespace-nowrap">
                Previewing {previewIdx() + 1} of {count()}
              </span>
              <IconButton
                size="sm"
                onClick={() => setPreviewIdx((i) => Math.min(count() - 1, i + 1))}
                disabled={previewIdx() >= count() - 1}
                tooltip="Next sound (→)"
              >
                <ChevronRight size={14} />
              </IconButton>
            </div>
          </Show>
        </div>

        {/* Waveforms */}
        <div class="px-3.5 pt-3 flex flex-col gap-1.5 shrink-0">
          <div class="flex items-center justify-between text-md">
            <span class="font-medium text-[var(--text-main)] truncate">
              Original
              <span class="font-normal text-[var(--text-muted)]">
                {' '}
                · {item().name ?? row().filename}
                {region() ? ` · ${formatTime(region()!.start)} – ${formatTime(region()!.end)}` : ''}
              </span>
            </span>
            <span class="text-[var(--text-muted)]">Click a waveform to play it from there</span>
          </div>
          <div
            id="effects-original-wave"
            ref={origWrap}
            class="relative w-full h-28 bg-[#1e2022] border rounded-[3px] overflow-hidden cursor-pointer"
            classList={{
              'border-[#1c1d1f]': hearing() !== 'original',
              'border-white/40': hearing() === 'original'
            }}
            onMouseDown={(e) => seekFrom('original', e, origWrap)}
          >
            <canvas ref={origCanvas} class="w-full h-full block" />
            <Show when={!original() && !loadError()}>
              <div class="absolute inset-0 flex items-center justify-center gap-2 text-md text-[#8b949e]">
                <RefreshCw size={16} class="animate-spin text-[#007acc]" />
                <span>Decoding audio…</span>
              </div>
            </Show>
            <Show when={loadError()}>
              <div class="absolute inset-0 flex items-center justify-center text-md text-red-400 px-6 text-center">
                {loadError()}
              </div>
            </Show>
          </div>

          <div class="flex items-center justify-between text-md mt-1.5">
            <span class="font-medium truncate" style={{ color: RESULT_COLOR }}>
              With effects
              <span class="font-normal text-[var(--text-muted)]">
                {summary().length > 0 ? ` · ${summary().join(' · ')}` : ''}
              </span>
            </span>
            <Show when={rendering()}>
              <span class="flex items-center gap-1.5 text-[var(--text-muted)]">
                <RefreshCw size={12} class="animate-spin" /> Rendering…
              </span>
            </Show>
          </div>
          <div
            id="effects-result-wave"
            ref={outWrap}
            class="relative w-full h-28 bg-[#1e2022] border rounded-[3px] overflow-hidden"
            classList={{
              'cursor-pointer': !!result(),
              'border-[#1c1d1f]': hearing() !== 'effects',
              'border-amber-400/60': hearing() === 'effects'
            }}
            onMouseDown={(e) => seekFrom('effects', e, outWrap)}
          >
            <canvas ref={outCanvas} class="w-full h-full block" />
            <Show when={!rackActive()}>
              <div class="absolute inset-0 flex items-center justify-center text-md text-[var(--text-muted)] px-6 text-center">
                No effects yet. Pick a preset on the left or change a setting below.
              </div>
            </Show>
            <Show when={renderError()}>
              <div class="absolute inset-0 flex items-center justify-center text-md text-red-400 px-6 text-center">
                Couldn't apply effects: {renderError()}
              </div>
            </Show>
          </div>
        </div>

        {/* Controls */}
        <div class="min-h-0 overflow-y-auto dcc-scroll px-3.5 py-3">
          <div class="grid grid-cols-4 gap-3">
            <BasicsCard />
            <SpeedPitchCard />
            <FadesCard />
            <LevelCard readout={readout()} />
          </div>
        </div>

        {/* Footer: output */}
        <div class="px-3.5 py-3 flex items-center gap-3 border-t border-[var(--border-color)] shrink-0">
          <div class="flex flex-col min-w-0 flex-1 text-md">
            <span class="text-[var(--text-muted)]">
              {multi()
                ? `Drag or export applies these effects to all ${count()} ${props.noun}. Originals are never changed.`
                : 'Drag or export to get the result as a new file. The original is never changed.'}
              {props.items.some((it) => it.excludeFades) &&
              (rack().fadeIn > 0 || rack().fadeOut > 0)
                ? ' Fades are skipped so the loop stays seamless.'
                : ''}
            </span>
            <span class="font-mono text-[var(--text-main)] truncate" title="Output file name">
              {exampleName()}
            </span>
          </div>
          <Show when={props.onSendTo && !multi()}>
            <Button
              id="effects-send-slicer"
              size="sm"
              icon={<Scissors size={13} />}
              onClick={() => sendTo('slicer')}
              disabled={!result()}
              title={result() ? 'Cut the processed result into slices' : 'Add an effect first'}
            >
              Slice result…
            </Button>
            <Button
              id="effects-send-loop"
              size="sm"
              icon={<Repeat size={13} />}
              onClick={() => sendTo('loop')}
              disabled={!result()}
              title={
                result() ? 'Make a seamless loop from the processed result' : 'Add an effect first'
              }
            >
              Loop result…
            </Button>
          </Show>
          <div
            id="effects-drag-handle"
            draggable={dragReady()}
            onDragStart={onDragStart}
            class="h-8 px-3 flex items-center gap-1.5 rounded-[3px] border text-md font-medium whitespace-nowrap transition-colors"
            classList={{
              'cursor-grab active:cursor-grabbing bg-[#1e2022] border-[#007acc]/60 text-[#f0f3f6] hover:bg-[#007acc]/20':
                dragReady(),
              'cursor-wait bg-[#1e2022] border-[#1c1d1f] text-[var(--text-muted)]': !dragReady()
            }}
            title="Drag straight into your editor or DAW. Files are kept in the Drag Exports folder."
          >
            <Show when={dragReady()} fallback={<RefreshCw size={13} class="animate-spin" />}>
              <GripVertical size={14} />
            </Show>
            {dragLabel()}
          </div>
          <Button
            id="effects-export-btn"
            variant="primary"
            size="sm"
            onClick={exportAll}
            icon={<Download size={13} />}
            title="Export with these effects (Ctrl+E)"
          >
            {multi()
              ? `Export ${count()} ${props.noun[0].toUpperCase()}${props.noun.slice(1)}…`
              : 'Export…'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---- Presets ----

function PresetSidebar(): JSX.Element {
  const [naming, setNaming] = createSignal(false)
  const [newName, setNewName] = createSignal('')

  const userPresets = (): ReturnType<typeof presets> => presets().filter((p) => !p.builtin)
  const builtinPresets = (): ReturnType<typeof presets> => presets().filter((p) => p.builtin)

  async function saveAs(): Promise<void> {
    const name = newName().trim()
    if (!name) return
    const list = await window.api.savePreset({ name, settings: effectsOf(rack()) })
    setPresets(list)
    const saved = [...list].reverse().find((p) => p.name === name && !p.builtin)
    if (saved) applyPreset(saved)
    setNaming(false)
    setNewName('')
    showToast({ type: 'success', title: `Saved preset "${name}"` })
  }

  async function updateActive(): Promise<void> {
    const p = activePreset()
    if (!p || p.builtin) return
    setPresets(await window.api.savePreset({ id: p.id, name: p.name, settings: effectsOf(rack()) }))
    showToast({ type: 'success', title: `Updated "${p.name}"` })
  }

  async function remove(id: string, name: string): Promise<void> {
    if (!window.confirm(`Delete preset "${name}"?`)) return
    setPresets(await window.api.deletePreset(id))
    if (activePresetId() === id) clearActivePreset()
  }

  async function importPresets(): Promise<void> {
    const res = await window.api.importPresets()
    if (!res) return
    setPresets(res.presets)
    showToast({
      type: 'success',
      title: `Imported ${res.added} preset${res.added === 1 ? '' : 's'}`
    })
  }

  async function exportPresets(): Promise<void> {
    const n = await window.api.exportPresets()
    if (n !== null)
      showToast({ type: 'success', title: `Exported ${n} preset${n === 1 ? '' : 's'}` })
  }

  const item = (p: ReturnType<typeof presets>[number]): JSX.Element => {
    const active = (): boolean => p.id === activePresetId()
    return (
      <div
        class="group flex items-center h-8 shrink-0 pr-1 rounded-[3px] transition-colors"
        classList={{
          'bg-[#007acc] text-white': active(),
          'text-[#f0f3f6] hover:bg-white/5': !active()
        }}
      >
        <button
          type="button"
          class="flex-1 min-w-0 h-full text-left px-2.5 truncate cursor-pointer"
          title={describeEffects({ ...DEFAULT_PROCESSING, ...p.settings }).join(', ')}
          onClick={() => applyPreset(p)}
        >
          {p.name}
          <Show when={active() && presetModified()}>
            <span class="ml-1.5 text-white/70">(edited)</span>
          </Show>
        </button>
        <Show when={!p.builtin}>
          <button
            type="button"
            class="w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-70 hover:opacity-100! cursor-pointer"
            title={`Delete "${p.name}"`}
            onClick={() => void remove(p.id, p.name)}
          >
            <Trash2 size={12} />
          </button>
        </Show>
      </div>
    )
  }

  return (
    <div
      id="effects-presets"
      class="w-60 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-panel-header)] flex flex-col text-md"
    >
      <div class="flex-1 min-h-0 overflow-y-auto dcc-scroll p-2 flex flex-col gap-0.5">
        <div class="px-2.5 h-8 shrink-0 flex items-end pb-1.5 text-md font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Presets
        </div>
        <For each={builtinPresets()}>{item}</For>
        <div
          class="px-2.5 h-8 shrink-0 flex items-end pb-1.5 text-md font-bold uppercase tracking-wider text-[var(--text-muted)]"
          style={{ 'margin-top': '8px' }}
        >
          My presets
        </div>
        <Show
          when={userPresets().length > 0}
          fallback={
            <div class="px-2.5 py-1.5 text-[var(--text-muted)]">
              Dial in some effects, then save them here.
            </div>
          }
        >
          <For each={userPresets()}>{item}</For>
        </Show>
      </div>

      <div class="p-2 border-t border-[var(--border-color)] flex flex-col gap-1.5">
        <Show when={activePreset() && !activePreset()!.builtin && presetModified()}>
          <Button size="sm" onClick={() => void updateActive()} class="w-full justify-center">
            Update "{activePreset()!.name}"
          </Button>
        </Show>
        <Show
          when={naming()}
          fallback={
            <Button
              id="effects-save-preset"
              size="sm"
              icon={<Save size={13} />}
              onClick={() => setNaming(true)}
              disabled={!rackActive()}
              class="w-full justify-center"
              title={
                rackActive() ? 'Save the current effects as a preset' : 'Change something first'
              }
            >
              Save as preset…
            </Button>
          }
        >
          <input
            id="effects-preset-name"
            type="text"
            placeholder="Preset name"
            value={newName()}
            ref={(el) => setTimeout(() => el.focus(), 0)}
            onInput={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveAs()
              if (e.key === 'Escape') {
                e.stopPropagation()
                setNaming(false)
              }
            }}
            class="h-8 w-full px-2 bg-[#1e2022] border border-[#007acc] rounded-[3px] text-md text-[#f0f3f6] focus:outline-none"
          />
          <div class="flex gap-1.5">
            <Button
              size="sm"
              variant="primary"
              onClick={() => void saveAs()}
              disabled={!newName().trim()}
              class="flex-1 justify-center"
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNaming(false)}
              class="flex-1 justify-center"
            >
              Cancel
            </Button>
          </div>
        </Show>
        <div class="flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void importPresets()}
            class="flex-1 justify-center"
            title="Add presets from a .json file"
          >
            Import…
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void exportPresets()}
            class="flex-1 justify-center"
            title="Save your presets to a .json file to share"
          >
            Export…
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---- Controls ----
// Every control in the cards is one 32px row (label left, control right), with an
// optional full-width slider or segmented control under it, so sizes line up.

const SEGMENT_FILL = 'w-full [&>button]:flex-1 [&>button]:justify-center'

function Card(props: {
  title: string
  active: boolean
  onReset: () => void
  children: JSX.Element
}): JSX.Element {
  return (
    <div
      class="flex flex-col gap-2 p-3 rounded-[3px] border bg-[#1e2022] text-md"
      classList={{
        'border-amber-500/50': props.active,
        'border-[#1c1d1f]': !props.active
      }}
    >
      <div class="flex items-center justify-between h-8">
        <span
          class="font-semibold flex items-center gap-1.5"
          classList={{ 'text-amber-200': props.active, 'text-[var(--text-main)]': !props.active }}
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            classList={{ 'bg-amber-400': props.active, 'bg-[#4a4e55]': !props.active }}
          />
          {props.title}
        </span>
        <Show when={props.active}>
          <Button size="xs" variant="ghost" icon={<RotateCcw size={12} />} onClick={props.onReset}>
            Reset
          </Button>
        </Show>
      </div>
      {props.children}
    </div>
  )
}

function Row(props: { label: string; hint?: string; children: JSX.Element }): JSX.Element {
  return (
    <div class="flex items-center justify-between gap-2 h-8" title={props.hint}>
      <span class="text-[var(--text-main)] truncate">{props.label}</span>
      {props.children}
    </div>
  )
}

// Typed value with a unit. Commits on Enter or blur; ↑/↓ nudge by `step`.
function ValueBox(props: {
  value: number
  onChange: (v: number) => void
  unit: string
  step: number
  precision: number
  min: number
  max: number
  id?: string
}): JSX.Element {
  const clamp = (v: number): number => Math.min(props.max, Math.max(props.min, v))
  const commit = (el: HTMLInputElement): void => {
    const v = parseFloat(el.value.replace('−', '-'))
    if (Number.isFinite(v)) props.onChange(clamp(v))
    el.value = props.value.toFixed(props.precision)
  }
  return (
    <label class="flex items-center w-28 h-8 px-2 gap-1.5 bg-[#26282b] border border-[#1c1d1f] focus-within:border-[#007acc] rounded-[3px] shrink-0 cursor-text">
      <input
        id={props.id}
        type="text"
        inputmode="decimal"
        class="flex-1 min-w-0 bg-transparent font-mono tabular-nums text-right text-md text-[#f0f3f6] focus:outline-none"
        value={props.value.toFixed(props.precision)}
        onChange={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            props.onChange(clamp(props.value + (e.key === 'ArrowUp' ? 1 : -1) * props.step))
          }
        }}
      />
      <span class="w-9 text-[var(--text-muted)] text-md">{props.unit}</span>
    </label>
  )
}

// Full-width slider. Double-click resets to `neutral`.
function Slider(props: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  neutral: number
}): JSX.Element {
  return (
    <input
      type="range"
      min={props.min}
      max={props.max}
      step={props.step}
      value={Math.min(props.max, Math.max(props.min, props.value))}
      onInput={(e) => props.onChange(parseFloat(e.currentTarget.value))}
      onDblClick={() => props.onChange(props.neutral)}
      class="block w-full h-4 accent-[#f5a524] cursor-pointer"
      title="Double-click to reset"
    />
  )
}

// On/off switch. The thumb is placed by flex alignment, not pixel offsets, so it
// stays centred at any zoom level.
function Pill(props: { id: string; on: boolean; onChange: (on: boolean) => void }): JSX.Element {
  return (
    <button
      id={props.id}
      type="button"
      role="switch"
      aria-checked={props.on}
      class="flex items-center w-9 h-5 p-[3px] rounded-full border shrink-0 transition-colors cursor-pointer"
      classList={{
        'justify-end bg-amber-500 border-amber-500': props.on,
        'justify-start bg-[#26282b] border-[#4a4e55] hover:border-[#8b949e]': !props.on
      }}
      onClick={() => props.onChange(!props.on)}
    >
      <span
        class="block w-3 h-3 rounded-full"
        classList={{ 'bg-white': props.on, 'bg-[#8b949e]': !props.on }}
      />
    </button>
  )
}

function BasicsCard(): JSX.Element {
  const r = rack
  return (
    <Card
      title="Basics"
      active={r().reverse || r().mono}
      onReset={() => updateRack({ reverse: false, mono: false })}
    >
      <Row label="Reverse" hint="Play backwards">
        <Pill id="effects-reverse" on={r().reverse} onChange={(v) => updateRack({ reverse: v })} />
      </Row>
      <Row label="Mono" hint="Mix to one channel">
        <Pill id="effects-mono" on={r().mono} onChange={(v) => updateRack({ mono: v })} />
      </Row>
    </Card>
  )
}

function SpeedPitchCard(): JSX.Element {
  const r = rack
  const roundSpeed = (v: number): number => Math.round(v * 100) / 100
  return (
    <Card
      title="Speed & Pitch"
      active={r().speed !== 1 || r().pitch !== 0}
      onReset={() => updateRack({ speed: 1, pitch: 0, speedMode: 'varispeed' })}
    >
      <Row label="Speed">
        <ValueBox
          id="effects-speed"
          value={r().speed}
          onChange={(v) => updateRack({ speed: v })}
          unit="×"
          step={0.05}
          precision={2}
          min={LIMITS.speed.min}
          max={LIMITS.speed.max}
        />
      </Row>
      {/* Log scale so 0.5× and 2× sit equally either side of 1×. */}
      <Slider
        value={Math.log2(r().speed)}
        onChange={(p) => updateRack({ speed: roundSpeed(Math.pow(2, p)) })}
        min={Math.log2(LIMITS.speed.min)}
        max={Math.log2(LIMITS.speed.max)}
        step={0.001}
        neutral={0}
      />
      <div
        title="Pitch follows: like tape, faster is higher. Keep pitch: only the length changes."
        classList={{ 'opacity-40 pointer-events-none': r().speed === 1 }}
      >
        <SegmentedControl
          id="effects-speed-mode"
          class={SEGMENT_FILL}
          value={r().speedMode}
          onChange={(v) => updateRack({ speedMode: v as 'varispeed' | 'stretch' })}
          items={[
            { id: 'varispeed', label: 'Pitch follows' },
            { id: 'stretch', label: 'Keep pitch' }
          ]}
        />
      </div>
      <Row
        label="Pitch"
        hint={
          capabilities().rubberband
            ? 'Semitones. Length stays the same.'
            : 'Semitones. Length stays the same (basic quality in this build).'
        }
      >
        <ValueBox
          id="effects-pitch"
          value={r().pitch}
          onChange={(v) => updateRack({ pitch: v })}
          unit="st"
          step={1}
          precision={1}
          min={LIMITS.pitch.min}
          max={LIMITS.pitch.max}
        />
      </Row>
      <Slider
        value={r().pitch}
        onChange={(v) => updateRack({ pitch: v })}
        min={LIMITS.pitch.min}
        max={LIMITS.pitch.max}
        step={1}
        neutral={0}
      />
    </Card>
  )
}

function FadesCard(): JSX.Element {
  const r = rack
  // The slider covers the useful range; the box accepts up to the full limit.
  const SLIDER_MAX_MS = 2000
  const fadeRow = (id: string, label: string, key: 'fadeIn' | 'fadeOut'): JSX.Element => (
    <>
      <Row label={label}>
        <ValueBox
          id={id}
          value={Math.round(r()[key] * 1000)}
          onChange={(v) => updateRack({ [key]: v / 1000 })}
          unit="ms"
          step={5}
          precision={0}
          min={0}
          max={LIMITS.fade.max * 1000}
        />
      </Row>
      <Slider
        value={Math.round(r()[key] * 1000)}
        onChange={(v) => updateRack({ [key]: v / 1000 })}
        min={0}
        max={SLIDER_MAX_MS}
        step={5}
        neutral={0}
      />
    </>
  )
  return (
    <Card
      title="Fades"
      active={r().fadeIn > 0 || r().fadeOut > 0}
      onReset={() => updateRack({ fadeIn: 0, fadeOut: 0 })}
    >
      {fadeRow('effects-fade-in', 'Fade in', 'fadeIn')}
      {fadeRow('effects-fade-out', 'Fade out', 'fadeOut')}
      <div
        title="Fade shape"
        classList={{ 'opacity-40 pointer-events-none': r().fadeIn === 0 && r().fadeOut === 0 }}
      >
        <SegmentedControl
          id="effects-fade-curve"
          class={SEGMENT_FILL}
          value={r().fadeCurve}
          onChange={(v) => updateRack({ fadeCurve: v as FadeCurve })}
          items={[
            { id: 'linear', label: 'Linear' },
            { id: 'scurve', label: 'Smooth' },
            { id: 'exp', label: 'Exp' },
            { id: 'log', label: 'Log' }
          ]}
        />
      </div>
    </Card>
  )
}

type LevelChoice = 'none' | 'volume' | 'peak' | 'lufs'

const LUFS_TARGETS = [
  { id: '-14', label: '−14', hint: 'Streaming (Spotify, YouTube)' },
  { id: '-16', label: '−16', hint: 'Podcasts' },
  { id: '-23', label: '−23', hint: 'Broadcast (EBU R128)' }
]

function LevelCard(props: {
  readout: { m: LoudnessMeasurement | null; gain: GainDecision | null } | null
}): JSX.Element {
  const r = rack
  // "Volume" at 0 dB does nothing, so remember that the user picked it.
  const [pickedVolume, setPickedVolume] = createSignal(false)
  const choice = (): LevelChoice =>
    r().gainMode === 'peak'
      ? 'peak'
      : r().gainMode === 'lufs'
        ? 'lufs'
        : r().gainDb !== 0 || pickedVolume()
          ? 'volume'
          : 'none'

  function pick(c: LevelChoice): void {
    setPickedVolume(c === 'volume')
    if (c === 'none') updateRack({ gainMode: 'gain', gainDb: 0 })
    else if (c === 'volume') updateRack({ gainMode: 'gain' })
    else updateRack({ gainMode: c })
  }

  const m = (): LoudnessMeasurement | null => props.readout?.m ?? null
  const g = (): GainDecision | null => props.readout?.gain ?? null

  return (
    <Card title="Level" active={choice() !== 'none'} onReset={() => pick('none')}>
      <div title="Off: leave as is. Volume: fixed change. Peak: loudest moment hits a target. LUFS: match perceived loudness.">
        <SegmentedControl
          id="effects-level-mode"
          class={SEGMENT_FILL}
          value={choice()}
          onChange={(v) => pick(v as LevelChoice)}
          items={[
            { id: 'none', label: 'Off' },
            { id: 'volume', label: 'Volume' },
            { id: 'peak', label: 'Peak' },
            { id: 'lufs', label: 'LUFS' }
          ]}
        />
      </div>

      <Show when={choice() === 'volume'}>
        <Row label="Change by">
          <ValueBox
            id="effects-gain"
            value={r().gainDb}
            onChange={(v) => updateRack({ gainDb: v })}
            unit="dB"
            step={0.5}
            precision={1}
            min={LIMITS.gainDb.min}
            max={LIMITS.gainDb.max}
          />
        </Row>
        <Slider
          value={r().gainDb}
          onChange={(v) => updateRack({ gainDb: v })}
          min={LIMITS.gainDb.min}
          max={LIMITS.gainDb.max}
          step={0.5}
          neutral={0}
        />
      </Show>
      <Show when={choice() === 'peak'}>
        <Row label="Loudest peak at" hint="Raise or lower so the loudest moment hits this level">
          <ValueBox
            id="effects-peak"
            value={r().peakDb}
            onChange={(v) => updateRack({ peakDb: v })}
            unit="dB"
            step={0.5}
            precision={1}
            min={LIMITS.peakDb.min}
            max={LIMITS.peakDb.max}
          />
        </Row>
      </Show>
      <Show when={choice() === 'lufs'}>
        <Row label="Target">
          <ValueBox
            id="effects-lufs"
            value={r().lufs}
            onChange={(v) => updateRack({ lufs: v })}
            unit="LUFS"
            step={0.5}
            precision={1}
            min={LIMITS.lufs.min}
            max={LIMITS.lufs.max}
          />
        </Row>
        <div title={LUFS_TARGETS.map((t) => `${t.label}: ${t.hint}`).join('\n')}>
          <SegmentedControl
            id="effects-lufs-targets"
            class={SEGMENT_FILL}
            value={String(r().lufs)}
            onChange={(v) => updateRack({ lufs: parseFloat(v) })}
            items={LUFS_TARGETS}
          />
        </div>
        <Row label="Peak ceiling" hint="Never let the true peak go above this">
          <ValueBox
            value={r().truePeakDb}
            onChange={(v) => updateRack({ truePeakDb: v })}
            unit="dB"
            step={0.5}
            precision={1}
            min={LIMITS.truePeakDb.min}
            max={LIMITS.truePeakDb.max}
          />
        </Row>
      </Show>

      <div
        id="effects-loudness"
        class="mt-auto pt-2 border-t border-[#1c1d1f] text-md text-[var(--text-muted)] leading-relaxed"
      >
        <Show
          when={m()}
          fallback={capabilities().ebur128 ? 'Measuring…' : 'Loudness metering unavailable'}
        >
          <div>
            This sound:{' '}
            <span class="font-mono text-[var(--text-main)]">{fmtDb(m()!.integrated, ' LUFS')}</span>
            , peak <span class="font-mono text-[var(--text-main)]">{fmtDb(m()!.truePeak)}</span>
          </div>
          <Show when={choice() === 'peak' || choice() === 'lufs' ? g() : null}>
            {(gain) => (
              <div class="text-amber-200">
                Volume change: <span class="font-mono">{fmtDb(gain().gainDb)}</span>
                {gain().limitedByPeak ? ' (held back by the ceiling)' : ''}
                {gain().fellBackToPeak ? ' (too short for LUFS, used peak)' : ''}
              </div>
            )}
          </Show>
        </Show>
      </div>
    </Card>
  )
}
