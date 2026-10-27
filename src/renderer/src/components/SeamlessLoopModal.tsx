import { JSX, Show, createEffect, createSignal, on, onCleanup, onMount, untrack } from 'solid-js'
import {
  Download,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Scan,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut
} from 'lucide-solid'
import type { SoundRow } from '../../../preload/index'
import type { ExportFile } from './ExportModal'
import { type EffectsItem, virtualRow } from './EffectsModal'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { Kbd } from './ui/Kbd'
import { SegmentedControl } from './ui/SegmentedControl'
import { buildPeaks } from '../slicer'
import {
  RULER_H,
  type WaveSource,
  drawRuler,
  drawWaveform,
  formatTime,
  parseTimeInput,
  sizeCanvas,
  stemOf
} from '../waveformDraw'
import {
  type CrossfadeCurve,
  type LoopSettings,
  encodeWavFloat32,
  maxCrossfade,
  renderSeamlessLoop
} from '../seamlessLoop'

// Loop settings survive closing and reopening the tool for the same file (per app session).
const sessionLoops = new Map<string, LoopSettings & { name: string }>()

const MIN_LOOP_SEC = 0.02
const EDGE_HIT_PX = 6
const DRAG_THRESHOLD_PX = 4
const MIN_VIEW_SEC = 0.005
const HEAD_COLOR = '#3ecf8e'
const TAIL_COLOR = '#f5a524'
const REGION_COLOR = '#3b9eff'

type PreviewMode = 'seamless' | 'original'

export interface SeamlessLoopModalProps {
  row: SoundRow | null
  // Region already selected in the main waveform; becomes the loop region.
  seedRegion?: { start: number; end: number } | null
  // True while another modal (export) sits on top; keys/close are ignored.
  blocked: boolean
  onClose: () => void
  onExport: (files: ExportFile[]) => void
  // Open the finished loop in the Effects window.
  onEffects?: (items: EffectsItem[]) => void
}

export default function SeamlessLoopModal(props: SeamlessLoopModalProps): JSX.Element {
  return (
    <Modal
      id="loop-modal"
      isOpen={props.row !== null}
      onClose={() => {
        if (!props.blocked) props.onClose()
      }}
      title={
        <div class="flex items-center gap-2.5 min-w-0">
          <span>Seamless Loop</span>
          <span class="normal-case tracking-normal font-normal text-[var(--text-muted)] truncate">
            {props.row?.filename}
          </span>
        </div>
      }
      icon={<Repeat size={16} />}
      width="1280px"
      bodyClass="p-0!"
    >
      <Show when={props.row} keyed>
        {(row) => (
          <LoopEditor
            row={row}
            seedRegion={props.seedRegion}
            blocked={props.blocked}
            onExport={props.onExport}
            onEffects={props.onEffects}
          />
        )}
      </Show>
    </Modal>
  )
}

function LoopEditor(props: {
  row: SoundRow
  seedRegion?: { start: number; end: number } | null
  blocked: boolean
  onExport: (files: ExportFile[]) => void
  onEffects?: (items: EffectsItem[]) => void
}): JSX.Element {
  let srcCanvas: HTMLCanvasElement | undefined
  let srcWrap: HTMLDivElement | undefined
  let outCanvas: HTMLCanvasElement | undefined
  let outWrap: HTMLDivElement | undefined

  const stem = stemOf(props.row.filename)
  const saved = sessionLoops.get(props.row.path)

  // ---- Audio data ----
  let audioCtx: AudioContext | undefined
  let gainNode: GainNode | undefined
  let buffer: AudioBuffer | undefined
  let channels: Float32Array[] = []
  let wave: WaveSource | undefined
  const [loading, setLoading] = createSignal(true)
  const [loadError, setLoadError] = createSignal<string | null>(null)
  const [duration, setDuration] = createSignal(props.row.duration ?? 0)
  const [dataVersion, setDataVersion] = createSignal(0)

  // ---- Loop settings ----
  const [loopStart, setLoopStart] = createSignal(saved?.start ?? 0)
  const [loopEnd, setLoopEnd] = createSignal(saved?.end ?? 0)
  const [crossfade, setCrossfade] = createSignal(saved?.crossfade ?? 0)
  const [curve, setCurve] = createSignal<CrossfadeCurve>(saved?.curve ?? 'equal-power')
  const [name, setName] = createSignal(saved?.name ?? `${stem}_loop`)

  const regionLen = (): number => loopEnd() - loopStart()
  const effectiveXf = (): number => Math.min(crossfade(), maxCrossfade(loopStart(), loopEnd()))
  const loopLen = (): number => Math.max(0, regionLen() - effectiveXf())
  const settings = (): LoopSettings => ({
    start: loopStart(),
    end: loopEnd(),
    crossfade: effectiveXf(),
    curve: curve()
  })

  createEffect(() => {
    if (loopEnd() <= loopStart()) return
    sessionLoops.set(props.row.path, { ...settings(), crossfade: crossfade(), name: name() })
  })

  function setRegion(start: number, end: number): void {
    const dur = duration()
    let s = Math.max(0, Math.min(start, end))
    let e = Math.min(dur, Math.max(start, end))
    if (e - s < MIN_LOOP_SEC) {
      e = Math.min(dur, s + MIN_LOOP_SEC)
      s = Math.max(0, e - MIN_LOOP_SEC)
    }
    setLoopStart(s)
    setLoopEnd(e)
  }

  // ---- Rendered loop (debounced so dragging the region stays smooth on long files) ----
  const [rendered, setRendered] = createSignal<{
    channels: Float32Array[]
    wave: WaveSource
    length: number
  } | null>(null)
  let renderTimer: ReturnType<typeof setTimeout> | undefined

  function renderNow(): { channels: Float32Array[]; wave: WaveSource; length: number } | null {
    if (!buffer || loopEnd() <= loopStart()) return null
    const out = renderSeamlessLoop(channels, buffer.sampleRate, settings())
    return {
      channels: out,
      wave: { sampleRate: buffer.sampleRate, channels: out, peaks: buildPeaks(out) },
      length: (out[0]?.length ?? 0) / buffer.sampleRate
    }
  }

  createEffect(() => {
    dataVersion()
    settings()
    clearTimeout(renderTimer)
    renderTimer = setTimeout(() => setRendered(renderNow()), 40)
  })

  // ---- View (zoom/pan) for the source waveform ----
  const [viewStart, setViewStart] = createSignal(0)
  const [viewEnd, setViewEnd] = createSignal(props.row.duration ?? 1)

  function setView(start: number, end: number): void {
    const dur = duration()
    const span =
      dur > 0
        ? Math.min(dur, Math.max(MIN_VIEW_SEC, end - start))
        : Math.max(MIN_VIEW_SEC, end - start)
    let s = Math.max(0, start)
    if (dur > 0 && s + span > dur) s = Math.max(0, dur - span)
    setViewStart(s)
    setViewEnd(s + span)
  }

  function zoomAt(time: number, factor: number): void {
    const vs = viewStart()
    const span = viewEnd() - vs
    const newSpan = span * factor
    const frac = span > 0 ? (time - vs) / span : 0.5
    setView(time - frac * newSpan, time - frac * newSpan + newSpan)
  }

  const zoomCenter = (factor: number): void => zoomAt((viewStart() + viewEnd()) / 2, factor)
  const zoomToFit = (): void => setView(0, duration())
  const zoomToRegion = (): void => {
    const pad = regionLen() * 0.1
    setView(loopStart() - pad, loopEnd() + pad)
  }

  // ---- Playback: A/B between the raw region loop and the seamless render ----
  const [mode, setMode] = createSignal<PreviewMode>('seamless')
  const [playing, setPlaying] = createSignal(false)
  // Position inside the loop, in seconds from its start.
  const [loopPos, setLoopPos] = createSignal(0)
  const [volume, setVolume] = createSignal(1)
  const [muted, setMuted] = createSignal(false)
  let source: AudioBufferSourceNode | undefined
  let playStartCtxTime = 0
  let playStartPos = 0
  let playLoopLen = 0
  let rafId: number | undefined

  function getCtx(): AudioContext {
    if (!audioCtx) {
      audioCtx = new AudioContext()
      gainNode = audioCtx.createGain()
      gainNode.connect(audioCtx.destination)
      gainNode.gain.value = muted() ? 0 : volume()
    }
    return audioCtx
  }

  createEffect(() => {
    const v = muted() ? 0 : volume()
    if (gainNode) gainNode.gain.value = v
  })

  function currentPos(): number {
    if (!audioCtx || !playing() || playLoopLen <= 0) return loopPos()
    return (playStartPos + audioCtx.currentTime - playStartCtxTime) % playLoopLen
  }

  function stopSource(): void {
    if (source) {
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

  function startPlayback(pos: number): void {
    const r = rendered()
    if (!buffer || !r) return
    const ctx = getCtx()
    void ctx.resume()
    stopSource()
    const src = ctx.createBufferSource()
    src.loop = true
    let offset: number
    if (mode() === 'original') {
      src.buffer = buffer
      src.loopStart = loopStart()
      src.loopEnd = loopEnd()
      playLoopLen = regionLen()
      offset = loopStart() + (pos % playLoopLen)
    } else {
      const out = ctx.createBuffer(r.channels.length, r.channels[0].length, buffer.sampleRate)
      r.channels.forEach((ch, i) => out.copyToChannel(ch as Float32Array<ArrayBuffer>, i))
      src.buffer = out
      playLoopLen = r.length
      offset = pos % playLoopLen
    }
    src.connect(gainNode!)
    src.start(0, offset)
    source = src
    playStartCtxTime = ctx.currentTime
    playStartPos = pos % playLoopLen
    setPlaying(true)
    rafId = requestAnimationFrame(tick)
  }

  function tick(): void {
    if (!playing()) return
    setLoopPos(currentPos())
    rafId = requestAnimationFrame(tick)
  }

  function stop(): void {
    if (playing()) setLoopPos(currentPos())
    stopSource()
    setPlaying(false)
  }

  function togglePlay(): void {
    if (playing()) stop()
    else startPlayback(loopPos())
  }

  function switchMode(next: PreviewMode): void {
    if (next === mode()) return
    const pos = currentPos()
    setMode(next)
    // Same position in both modes: past the crossfade they play identical samples.
    if (playing()) startPlayback(pos)
  }

  // Restart with the new render so crossfade/region tweaks are heard immediately.
  createEffect(
    on(
      rendered,
      () => {
        if (untrack(playing)) startPlayback(currentPos())
      },
      { defer: true }
    )
  )

  // ---- Export ----
  const [exporting, setExporting] = createSignal(false)

  // Writes the loop to a temp file and hands it on (to Export or to Effects).
  async function withLoopFile(
    use: (path: string, outName: string, seconds: number) => void
  ): Promise<void> {
    if (exporting() || !buffer) return
    const r = renderNow()
    if (!r || r.length <= 0) return
    stop()
    setExporting(true)
    try {
      const outName = name().trim() || `${stem}_loop`
      const path = await window.api.writeTempWav(
        encodeWavFloat32(r.channels, buffer.sampleRate),
        outName
      )
      use(path, outName, r.length)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  const exportLoop = (): Promise<void> =>
    withLoopFile((path, outName) =>
      props.onExport([{ sourcePath: path, filename: `${outName}.wav`, name: outName }])
    )

  const effectsForLoop = (): Promise<void> =>
    withLoopFile((path, outName, seconds) =>
      props.onEffects?.([
        {
          row: virtualRow(path, `${outName}.wav`, seconds),
          name: outName,
          excludeFades: true,
          virtual: true
        }
      ])
    )

  // ---- Loading ----
  onMount(async () => {
    try {
      const res = await fetch(window.api.audioUrl(props.row.path))
      const data = await res.arrayBuffer()
      const decoded = await getCtx().decodeAudioData(data)
      buffer = decoded
      channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
        decoded.getChannelData(i)
      )
      wave = { sampleRate: decoded.sampleRate, channels, peaks: buildPeaks(channels) }
      setDuration(decoded.duration)
      setView(0, decoded.duration)
      const seed = props.seedRegion
      if (seed) setRegion(seed.start, seed.end)
      else if (saved) setRegion(saved.start, saved.end)
      else setRegion(0, decoded.duration)
      if (!saved || seed) setCrossfade(Math.min(1, regionLen() * 0.2))
      setDataVersion((v) => v + 1)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  })

  // ---- Drawing ----
  function drawSource(): void {
    if (!srcCanvas) return
    sizeCanvas(srcCanvas, srcWrap)
    const ctx = srcCanvas.getContext('2d')
    if (!ctx || srcCanvas.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const width = srcCanvas.width / dpr
    const height = srcCanvas.height / dpr
    const vs = viewStart()
    const ve = viewEnd()
    const xOf = (t: number): number => ((t - vs) / (ve - vs)) * width
    const a = loopStart()
    const b = loopEnd()
    const xf = effectiveXf()
    const waveTop = RULER_H
    const waveH = height - RULER_H

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)
    drawRuler(ctx, width, height, vs, ve)

    if (b > a) {
      ctx.fillStyle = REGION_COLOR
      ctx.globalAlpha = 0.1
      ctx.fillRect(xOf(a), waveTop, xOf(b) - xOf(a), waveH)
      ctx.globalAlpha = 0.22
      ctx.fillStyle = HEAD_COLOR
      ctx.fillRect(xOf(a), waveTop, xOf(a + xf) - xOf(a), waveH)
      ctx.fillStyle = TAIL_COLOR
      ctx.fillRect(xOf(b - xf), waveTop, xOf(b) - xOf(b - xf), waveH)
      ctx.globalAlpha = 1
    }

    if (wave) {
      drawWaveform(ctx, wave, Math.floor(width), waveTop, waveH, vs, ve, (t) => {
        if (t < a || t >= b) return 'rgba(255,255,255,0.18)'
        if (t < a + xf) return HEAD_COLOR
        if (t >= b - xf) return TAIL_COLOR
        return 'rgba(255,255,255,0.6)'
      })
    }

    if (b > a) {
      ctx.strokeStyle = REGION_COLOR
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(xOf(a), waveTop)
      ctx.lineTo(xOf(a), height)
      ctx.moveTo(xOf(b), waveTop)
      ctx.lineTo(xOf(b), height)
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.font = 'bold 10px JetBrains Mono, monospace'
      ctx.textBaseline = 'middle'
      if (xf > 0) {
        ctx.fillStyle = HEAD_COLOR
        ctx.fillText('HEAD (fades in)', Math.max(2, xOf(a)) + 4, waveTop + 10)
        const label = 'TAIL (fades out over head)'
        ctx.fillStyle = TAIL_COLOR
        ctx.fillText(
          label,
          Math.min(width - 2, xOf(b)) - ctx.measureText(label).width - 4,
          waveTop + 10
        )
      }
    }

    // In "original" mode the playhead walks the raw region.
    if (mode() === 'original' || !playing()) {
      const px = Math.round(xOf(a + loopPos()))
      if (px >= 0 && px <= width) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(px, 0, 1.5, height)
      }
    }
    ctx.restore()
  }

  // The rendered loop, drawn twice back to back so the seam is visible in the middle.
  function drawResult(): void {
    if (!outCanvas) return
    sizeCanvas(outCanvas, outWrap)
    const ctx = outCanvas.getContext('2d')
    if (!ctx || outCanvas.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const width = outCanvas.width / dpr
    const height = outCanvas.height / dpr
    const r = rendered()
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)
    if (r && r.length > 0) {
      const L = r.length
      const xf = effectiveXf()
      drawRuler(ctx, width, height, 0, 2 * L)
      const half = width / 2
      const waveTop = RULER_H
      const waveH = height - RULER_H
      for (const x0 of [0, half]) {
        ctx.save()
        ctx.translate(x0, 0)
        ctx.globalAlpha = 0.18
        ctx.fillStyle = HEAD_COLOR
        ctx.fillRect(0, waveTop, (xf / L) * half, waveH)
        ctx.globalAlpha = 1
        drawWaveform(ctx, r.wave, Math.floor(half), waveTop, waveH, 0, L, (t) =>
          t < xf ? '#a7e8c9' : 'rgba(255,255,255,0.6)'
        )
        ctx.restore()
      }
      ctx.strokeStyle = '#ffffff'
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(Math.round(half) + 0.5, waveTop)
      ctx.lineTo(Math.round(half) + 0.5, height)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = 'bold 10px JetBrains Mono, monospace'
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.fillText('LOOP POINT', Math.round(half) + 5, waveTop + 10)

      if (mode() === 'seamless' && playing()) {
        const px = Math.round((loopPos() / L) * half)
        ctx.fillRect(px, 0, 1.5, height)
      }
    }
    ctx.restore()
  }

  createEffect(() => {
    dataVersion()
    loopStart()
    loopEnd()
    crossfade()
    viewStart()
    viewEnd()
    loopPos()
    mode()
    playing()
    drawSource()
  })

  createEffect(() => {
    rendered()
    loopPos()
    mode()
    playing()
    drawResult()
  })

  // ---- Pointer interaction on the source waveform ----
  type DragMode =
    | { kind: 'create'; anchor: number; startX: number; moved: boolean }
    | { kind: 'move'; grabTime: number; origStart: number; origEnd: number }
    | { kind: 'resize'; edge: 'start' | 'end' }
  let drag: DragMode | null = null
  const [hoverCursor, setHoverCursor] = createSignal('crosshair')

  function timeAtX(clientX: number): number {
    if (!srcWrap) return 0
    const rect = srcWrap.getBoundingClientRect()
    const frac = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0
    return viewStart() + frac * (viewEnd() - viewStart())
  }

  function hitTest(clientX: number): 'start' | 'end' | 'body' | null {
    if (!srcWrap) return null
    const rect = srcWrap.getBoundingClientRect()
    const x = clientX - rect.left
    const xOf = (t: number): number => ((t - viewStart()) / (viewEnd() - viewStart())) * rect.width
    if (Math.abs(x - xOf(loopEnd())) <= EDGE_HIT_PX) return 'end'
    if (Math.abs(x - xOf(loopStart())) <= EDGE_HIT_PX) return 'start'
    if (x > xOf(loopStart()) && x < xOf(loopEnd())) return 'body'
    return null
  }

  function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || !buffer) return
    const hit = hitTest(e.clientX)
    const t = timeAtX(e.clientX)
    if (hit === 'start' || hit === 'end') drag = { kind: 'resize', edge: hit }
    else if (hit === 'body')
      drag = { kind: 'move', grabTime: t, origStart: loopStart(), origEnd: loopEnd() }
    else drag = { kind: 'create', anchor: t, startX: e.clientX, moved: false }
    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
  }

  function onHover(e: MouseEvent): void {
    if (drag) return
    const hit = hitTest(e.clientX)
    setHoverCursor(hit === 'body' ? 'grab' : hit ? 'ew-resize' : 'crosshair')
  }

  function onWindowMouseMove(e: MouseEvent): void {
    if (!drag) return
    const t = timeAtX(e.clientX)
    if (drag.kind === 'create') {
      if (Math.abs(e.clientX - drag.startX) > DRAG_THRESHOLD_PX) drag.moved = true
      if (drag.moved) setRegion(drag.anchor, t)
    } else if (drag.kind === 'move') {
      const len = drag.origEnd - drag.origStart
      const s = Math.min(Math.max(0, drag.origStart + (t - drag.grabTime)), duration() - len)
      setLoopStart(s)
      setLoopEnd(s + len)
    } else if (drag.edge === 'start') {
      setLoopStart(Math.min(Math.max(0, t), loopEnd() - MIN_LOOP_SEC))
    } else {
      setLoopEnd(Math.max(Math.min(duration(), t), loopStart() + MIN_LOOP_SEC))
    }
  }

  function onWindowMouseUp(): void {
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
    drag = null
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      zoomAt(timeAtX(e.clientX), e.deltaY > 0 ? 1.25 : 0.8)
    } else {
      const span = viewEnd() - viewStart()
      const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / 600
      setView(viewStart() + delta * span, viewEnd() + delta * span)
    }
  }

  // ---- Keyboard ----
  function onKeyDown(e: KeyboardEvent): void {
    if (props.blocked) return
    const active = document.activeElement
    const typing =
      (active?.tagName === 'INPUT' &&
        !['range', 'checkbox', 'radio', 'button'].includes((active as HTMLInputElement).type)) ||
      active?.tagName === 'TEXTAREA'
    const mod = e.ctrlKey || e.metaKey

    if (mod && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      void exportLoop()
      return
    }
    if (typing) {
      if (e.key === 'Enter') (active as HTMLInputElement).blur()
      return
    }
    if (e.code === 'Space') {
      e.preventDefault()
      togglePlay()
    } else if (e.key.toLowerCase() === 'b' && !mod) {
      e.preventDefault()
      switchMode(mode() === 'seamless' ? 'original' : 'seamless')
    } else if (e.key === '=' || e.key === '+') {
      e.preventDefault()
      zoomCenter(0.8)
    } else if (e.key === '-') {
      e.preventDefault()
      zoomCenter(1.25)
    } else if (e.key === '0') {
      e.preventDefault()
      zoomToFit()
    }
  }

  let resizeObserver: ResizeObserver | undefined
  onMount(() => {
    window.addEventListener('keydown', onKeyDown)
    resizeObserver = new ResizeObserver(() => {
      drawSource()
      drawResult()
    })
    if (srcWrap) resizeObserver.observe(srcWrap)
    if (outWrap) resizeObserver.observe(outWrap)
    // Wheel must be non-passive to stop the page from scrolling while zooming.
    srcWrap?.addEventListener('wheel', onWheel, { passive: false })
  })

  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
    srcWrap?.removeEventListener('wheel', onWheel)
    resizeObserver?.disconnect()
    clearTimeout(renderTimer)
    stopSource()
    void audioCtx?.close()
  })

  function editBound(edge: 'start' | 'end', input: HTMLInputElement): void {
    const t = parseTimeInput(input.value)
    if (t === null) {
      input.value = formatTime(edge === 'start' ? loopStart() : loopEnd())
      return
    }
    if (edge === 'start') setRegion(t, loopEnd())
    else setRegion(loopStart(), t)
  }

  const ready = (): boolean => !loading() && !loadError()
  const timeInputClass =
    'h-7 w-28 px-2 bg-[#1e2022] border border-[#1c1d1f] focus:border-[#007acc] rounded-[3px] font-mono text-md tabular-nums text-[#f0f3f6] focus:outline-none'

  return (
    <div id="loop-editor" class="flex flex-col min-h-0 select-none">
      {/* Toolbar */}
      <div
        id="loop-toolbar"
        class="h-12 px-3.5 flex items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-panel-header)] shrink-0"
      >
        <Button
          id="loop-play-btn"
          variant="primary"
          size="sm"
          onClick={togglePlay}
          disabled={!ready() || !rendered()}
          icon={playing() ? <Pause size={14} /> : <Play size={14} />}
          title={playing() ? 'Stop (Space)' : 'Play loop (Space)'}
        >
          {playing() ? 'Stop' : 'Play'}
        </Button>
        <SegmentedControl
          id="loop-ab-control"
          value={mode()}
          onChange={(v) => switchMode(v as PreviewMode)}
          items={[
            { id: 'seamless', label: 'Seamless' },
            { id: 'original', label: 'Original' }
          ]}
        />
        <span
          class="text-md text-[var(--text-muted)]"
          title="Toggle Seamless / Original while playing"
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
            id="loop-volume-slider"
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
        <span id="loop-time" class="font-mono text-md tabular-nums text-[var(--text-muted)] px-2">
          <span class="text-[var(--accent-color)]">{formatTime(loopPos())}</span> /{' '}
          {formatTime(mode() === 'seamless' ? loopLen() : regionLen())}
        </span>

        <div class="flex-1" />

        <div class="flex items-center gap-1">
          <IconButton size="sm" onClick={() => zoomCenter(0.8)} tooltip="Zoom in (+ / Ctrl+Wheel)">
            <ZoomIn size={14} />
          </IconButton>
          <IconButton size="sm" onClick={() => zoomCenter(1.25)} tooltip="Zoom out (-)">
            <ZoomOut size={14} />
          </IconButton>
          <IconButton size="sm" onClick={zoomToRegion} tooltip="Zoom to loop region">
            <Scan size={14} />
          </IconButton>
          <IconButton size="sm" onClick={zoomToFit} tooltip="Fit whole sound (0)">
            <Maximize2 size={14} />
          </IconButton>
        </div>
      </div>

      <div class="px-3.5 pt-3 flex flex-col gap-2 shrink-0">
        {/* Source */}
        <div class="flex items-center justify-between text-md">
          <span class="font-medium text-[var(--text-main)]">
            Source — drag to pick the loop region
          </span>
          <div class="flex items-center gap-2 text-[var(--text-muted)]">
            <span>Start</span>
            <input
              id="loop-start-input"
              type="text"
              class={timeInputClass}
              value={formatTime(loopStart())}
              onChange={(e) => editBound('start', e.currentTarget)}
            />
            <span>End</span>
            <input
              id="loop-end-input"
              type="text"
              class={timeInputClass}
              value={formatTime(loopEnd())}
              onChange={(e) => editBound('end', e.currentTarget)}
            />
          </div>
        </div>
        <div
          id="loop-source-container"
          ref={srcWrap}
          class="relative w-full h-52 bg-[#1e2022] border border-[#1c1d1f] rounded-[3px] overflow-hidden"
          style={{ cursor: hoverCursor() }}
          onMouseDown={onMouseDown}
          onMouseMove={onHover}
        >
          <canvas ref={srcCanvas} class="w-full h-full block" />
          <Show when={loading()}>
            <div class="absolute inset-0 flex items-center justify-center gap-2 bg-[#1e2022]/80 text-md text-[#8b949e]">
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

        {/* Crossfade controls */}
        <div id="loop-crossfade" class="flex items-center gap-3 text-md py-1">
          <label
            class="font-medium text-[var(--text-main)] shrink-0"
            title="How much of the tail is blended over the head"
          >
            Crossfade
          </label>
          <input
            id="loop-crossfade-slider"
            type="range"
            min="0"
            max={Math.max(1, Math.floor(maxCrossfade(loopStart(), loopEnd()) * 1000))}
            step="1"
            value={Math.round(effectiveXf() * 1000)}
            onInput={(e) => setCrossfade(parseInt(e.currentTarget.value, 10) / 1000)}
            class="flex-1 accent-[#007acc] h-2 cursor-pointer"
          />
          <span class="font-mono tabular-nums whitespace-nowrap w-36 text-right text-[var(--text-main)]">
            {(effectiveXf() * 1000).toFixed(0)} ms ·{' '}
            {regionLen() > 0 ? Math.round((effectiveXf() / regionLen()) * 100) : 0}%
          </span>
          <SegmentedControl
            id="loop-curve-control"
            value={curve()}
            onChange={(v) => setCurve(v as CrossfadeCurve)}
            items={[
              { id: 'equal-power', label: 'Equal Power' },
              { id: 'linear', label: 'Linear' }
            ]}
          />
        </div>

        {/* Result */}
        <div class="flex items-center justify-between text-md">
          <span class="font-medium text-[var(--text-main)]">
            Result — played twice, loop point in the middle
          </span>
          <span class="font-mono text-[var(--text-muted)]">
            {formatTime(regionLen())} region → {formatTime(loopLen())} loop
          </span>
        </div>
        <div
          id="loop-result-container"
          ref={outWrap}
          class="relative w-full h-36 bg-[#1e2022] border border-[#1c1d1f] rounded-[3px] overflow-hidden"
        >
          <canvas ref={outCanvas} class="w-full h-full block" />
        </div>

        <div class="flex items-center gap-3 text-md text-[var(--text-muted)] flex-wrap">
          <span>
            The <span style={{ color: TAIL_COLOR }}>tail</span> of the region is blended over its{' '}
            <span style={{ color: HEAD_COLOR }}>head</span>, so the end flows straight back into the
            start. Equal Power suits ambiences and noise; Linear suits tonal or rhythmic material.
          </span>
        </div>
      </div>

      {/* Footer */}
      <div class="px-3.5 py-3 flex items-center justify-end gap-3 border-t border-[var(--border-color)] mt-3">
        <label class="text-md text-[var(--text-muted)]">Output name</label>
        <input
          id="loop-name-input"
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder={`${stem}_loop`}
          class="h-8 w-72 px-2.5 bg-[#1e2022] border border-[#1c1d1f] focus:border-[#007acc] rounded-[3px] font-mono text-md text-[#f0f3f6] placeholder:text-[#8b949e]/60 focus:outline-none"
        />
        <Show when={props.onEffects}>
          <Button
            id="loop-effects-btn"
            size="sm"
            onClick={() => void effectsForLoop()}
            disabled={!ready() || exporting() || loopLen() <= 0}
            icon={<SlidersHorizontal size={13} />}
            title="Add effects to the loop (fades are skipped so it stays seamless)"
          >
            Effects…
          </Button>
        </Show>
        <Button
          id="loop-export-btn"
          variant="primary"
          size="sm"
          onClick={() => void exportLoop()}
          disabled={!ready() || exporting() || loopLen() <= 0}
          icon={exporting() ? <RefreshCw size={13} class="animate-spin" /> : <Download size={13} />}
          title="Export the seamless loop (Ctrl+E)"
        >
          Export Loop…
        </Button>
      </div>
    </div>
  )
}
