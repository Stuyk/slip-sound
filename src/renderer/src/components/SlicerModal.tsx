import { For, JSX, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import {
  Download,
  Flag,
  Maximize2,
  Pause,
  Play,
  Redo2,
  RefreshCw,
  Repeat,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  WandSparkles,
  ZoomIn,
  ZoomOut
} from 'lucide-solid'
import type { SoundRow } from '../../../preload/index'
import type { ExportFile } from './ExportModal'
import type { EffectsItem } from './EffectsModal'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { Badge } from './ui/Badge'
import { Kbd } from './ui/Kbd'
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
  type Slice,
  DEFAULT_DETECT_OPTIONS,
  MIN_SLICE_SEC,
  autoSliceName,
  buildPeaks,
  clampRange,
  detectSlices,
  sortSlices
} from '../slicer'

// Slices survive closing and reopening the slicer for the same file (per app session).
const sessionSlices = new Map<string, Slice[]>()

const SLICE_COLORS = [
  '#3b9eff',
  '#f5a524',
  '#3ecf8e',
  '#e5484d',
  '#a78bfa',
  '#2dd4bf',
  '#f472b6',
  '#facc15'
]
const EDGE_HIT_PX = 6
const DRAG_THRESHOLD_PX = 4
const MIN_VIEW_SEC = 0.005

function sliceColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length]
}

export interface SlicerModalProps {
  row: SoundRow | null
  // Region already selected in the main waveform; becomes the first slice.
  seedRegion?: { start: number; end: number } | null
  // True while another modal (export) sits on top; keys/close are ignored.
  blocked: boolean
  onClose: () => void
  onExport: (files: ExportFile[]) => void
  // Open the slices in the Effects window.
  onEffects?: (items: EffectsItem[]) => void
}

export default function SlicerModal(props: SlicerModalProps): JSX.Element {
  return (
    <Modal
      id="slicer-modal"
      isOpen={props.row !== null}
      onClose={() => {
        if (!props.blocked) props.onClose()
      }}
      title={
        <div class="flex items-center gap-2.5 min-w-0">
          <span>Slicer</span>
          <span class="normal-case tracking-normal font-normal text-[var(--text-muted)] truncate">
            {props.row?.filename}
          </span>
        </div>
      }
      icon={<Scissors size={16} />}
      width="1280px"
      bodyClass="p-0!"
    >
      <Show when={props.row} keyed>
        {(row) => (
          <SlicerEditor
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

function SlicerEditor(props: {
  row: SoundRow
  seedRegion?: { start: number; end: number } | null
  blocked: boolean
  onExport: (files: ExportFile[]) => void
  onEffects?: (items: EffectsItem[]) => void
}): JSX.Element {
  let canvas: HTMLCanvasElement | undefined
  let canvasWrap: HTMLDivElement | undefined
  let overview: HTMLCanvasElement | undefined
  let overviewWrap: HTMLDivElement | undefined

  const stem = stemOf(props.row.filename)

  // ---- Audio data ----
  let audioCtx: AudioContext | undefined
  let gainNode: GainNode | undefined
  let buffer: AudioBuffer | undefined
  let channels: Float32Array[] = []
  let wave: WaveSource | undefined
  const [loading, setLoading] = createSignal(true)
  const [loadError, setLoadError] = createSignal<string | null>(null)
  const [duration, setDuration] = createSignal(props.row.duration ?? 0)
  // Bumped when decoded audio becomes available, so effects redraw.
  const [dataVersion, setDataVersion] = createSignal(0)

  // ---- Slices + history ----
  const initial = sessionSlices.get(props.row.path) ?? []
  let nextId = initial.reduce((n, s) => Math.max(n, s.id), 0) + 1
  const [slices, setSlicesRaw] = createSignal<Slice[]>(initial)
  const [selectedId, setSelectedId] = createSignal<number | null>(null)
  const undoStack: Slice[][] = []
  const [redoStack, setRedoStack] = createSignal<Slice[][]>([])
  const [undoCount, setUndoCount] = createSignal(0)

  function setSlices(next: Slice[]): void {
    const sorted = sortSlices(next)
    setSlicesRaw(sorted)
    sessionSlices.set(props.row.path, sorted)
  }

  // Records `before` as an undo step; call after a change has been applied.
  function pushHistory(before: Slice[]): void {
    undoStack.push(before)
    if (undoStack.length > 200) undoStack.shift()
    setUndoCount(undoStack.length)
    setRedoStack([])
  }

  function commit(next: Slice[]): void {
    pushHistory(slices())
    setSlices(next)
  }

  function undo(): void {
    const prev = undoStack.pop()
    if (!prev) return
    setRedoStack([...redoStack(), slices()])
    setUndoCount(undoStack.length)
    setSlices(prev)
    if (!prev.some((s) => s.id === selectedId())) setSelectedId(null)
  }

  function redo(): void {
    const stack = redoStack()
    const next = stack[stack.length - 1]
    if (!next) return
    undoStack.push(slices())
    setUndoCount(undoStack.length)
    setRedoStack(stack.slice(0, -1))
    setSlices(next)
  }

  function addSlice(start: number, end: number): Slice {
    const range = clampRange(start, end, duration())
    const slice: Slice = { id: nextId++, start: range.start, end: range.end, name: '' }
    commit([...slices(), slice])
    setSelectedId(slice.id)
    return slice
  }

  function updateSlice(id: number, patch: Partial<Slice>, record = true): void {
    const next = slices().map((s) => (s.id === id ? { ...s, ...patch } : s))
    if (record) commit(next)
    else setSlices(next)
  }

  function deleteSlice(id: number): void {
    commit(slices().filter((s) => s.id !== id))
    if (selectedId() === id) setSelectedId(null)
  }

  function clearSlices(): void {
    if (slices().length === 0) return
    commit([])
    setSelectedId(null)
  }

  const selectedSlice = (): Slice | undefined => slices().find((s) => s.id === selectedId())
  const sliceIndex = (id: number): number => slices().findIndex((s) => s.id === id)
  const outputName = (s: Slice, i: number): string =>
    s.name.trim() || autoSliceName(stem, i, slices().length)

  // ---- View (zoom/pan), in seconds ----
  const [viewStart, setViewStart] = createSignal(0)
  const [viewEnd, setViewEnd] = createSignal(props.row.duration ?? 1)

  function setView(start: number, end: number): void {
    const dur = duration()
    let span = Math.min(dur, Math.max(MIN_VIEW_SEC, end - start))
    if (dur <= 0) span = Math.max(MIN_VIEW_SEC, end - start)
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

  function zoomCenter(factor: number): void {
    zoomAt((viewStart() + viewEnd()) / 2, factor)
  }

  function zoomToFit(): void {
    setView(0, duration())
  }

  function zoomToSlice(s: Slice): void {
    const pad = (s.end - s.start) * 0.15
    setView(s.start - pad, s.end + pad)
  }

  // ---- Playback (Web Audio: sample-accurate loops on the decoded buffer) ----
  const [playing, setPlaying] = createSignal(false)
  const [playhead, setPlayhead] = createSignal(0)
  const [loopEnabled, setLoopEnabled] = createSignal(true)
  const [volume, setVolume] = createSignal(1)
  const [muted, setMuted] = createSignal(false)
  let source: AudioBufferSourceNode | undefined
  let playStartCtxTime = 0
  let playStartOffset = 0
  let playRegion: { start: number; end: number; loop: boolean } | null = null
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

  function currentPosition(): number {
    if (!audioCtx || !playing()) return playhead()
    const elapsed = audioCtx.currentTime - playStartCtxTime
    let pos = playStartOffset + elapsed
    if (playRegion?.loop) {
      const len = playRegion.end - playRegion.start
      if (pos >= playRegion.end && len > 0)
        pos = playRegion.start + ((pos - playRegion.start) % len)
    }
    return Math.min(pos, playRegion?.end ?? duration())
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

  // Plays from `from`; with a region, stops (or loops) at the region end.
  function playFrom(from: number, region?: { start: number; end: number }): void {
    if (!buffer) return
    const ctx = getCtx()
    void ctx.resume()
    stopSource()
    const loop = !!region && loopEnabled()
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(gainNode!)
    const offset = Math.max(0, Math.min(from, buffer.duration))
    if (region && loop) {
      src.loop = true
      src.loopStart = region.start
      src.loopEnd = region.end
      src.start(0, offset)
    } else if (region) {
      src.start(0, offset, Math.max(0, region.end - offset))
    } else {
      src.start(0, offset)
    }
    src.onended = () => {
      if (source !== src) return
      source = undefined
      setPlaying(false)
      cancelAnimationFrame(rafId!)
      setPlayhead(region ? region.start : 0)
    }
    source = src
    playStartCtxTime = ctx.currentTime
    playStartOffset = offset
    playRegion = region ? { ...region, loop } : null
    setPlaying(true)
    rafId = requestAnimationFrame(tick)
  }

  function tick(): void {
    if (!playing()) return
    setPlayhead(currentPosition())
    rafId = requestAnimationFrame(tick)
  }

  function stop(): void {
    if (playing()) setPlayhead(currentPosition())
    stopSource()
    setPlaying(false)
  }

  function playSlice(s: Slice): void {
    setSelectedId(s.id)
    playFrom(s.start, { start: s.start, end: s.end })
  }

  function togglePlay(): void {
    if (playing()) {
      stop()
      return
    }
    const sel = selectedSlice()
    if (sel) {
      const ph = playhead()
      playFrom(ph > sel.start && ph < sel.end ? ph : sel.start, { start: sel.start, end: sel.end })
    } else {
      playFrom(playhead() >= duration() ? 0 : playhead())
    }
  }

  // ---- Live marking: press M at the start of a sound, M again at its end ----
  const [markAnchor, setMarkAnchor] = createSignal<number | null>(null)

  function mark(): void {
    const t = playing() ? currentPosition() : playhead()
    const anchor = markAnchor()
    if (anchor === null) {
      setMarkAnchor(t)
      return
    }
    setMarkAnchor(null)
    if (Math.abs(t - anchor) >= MIN_SLICE_SEC) addSlice(anchor, t)
  }

  // ---- Auto-detect ----
  const [thresholdDb, setThresholdDb] = createSignal(DEFAULT_DETECT_OPTIONS.thresholdDb)
  const [minGapMs, setMinGapMs] = createSignal(DEFAULT_DETECT_OPTIONS.minSilenceSec * 1000)

  function autoDetect(): void {
    if (!buffer) return
    const found = detectSlices(channels, buffer.sampleRate, {
      ...DEFAULT_DETECT_OPTIONS,
      thresholdDb: thresholdDb(),
      minSilenceSec: minGapMs() / 1000
    })
    commit(found.map((r) => ({ id: nextId++, start: r.start, end: r.end, name: '' })))
    setSelectedId(null)
  }

  // ---- Export ----
  function exportSlices(): void {
    const list = slices()
    if (list.length === 0) return
    stop()
    props.onExport(
      list.map((s, i) => ({
        sourcePath: props.row.path,
        filename: props.row.filename,
        start: s.start,
        end: s.end,
        name: outputName(s, i)
      }))
    )
  }

  function effectsForSlices(): void {
    const list = slices()
    if (list.length === 0 || !props.onEffects) return
    stop()
    props.onEffects(
      list.map((s, i) => ({ row: props.row, region: { start: s.start, end: s.end }, name: outputName(s, i) }))
    )
  }

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
      // Clamp restored slices in case the file changed length since they were made.
      setSlices(
        slices()
          .filter((s) => s.start < decoded.duration)
          .map((s) => ({ ...s, ...clampRange(s.start, s.end, decoded.duration) }))
      )
      const seed = props.seedRegion
      if (
        seed &&
        !slices().some(
          (s) => Math.abs(s.start - seed.start) < 0.001 && Math.abs(s.end - seed.end) < 0.001
        )
      ) {
        addSlice(seed.start, seed.end)
      }
      setDataVersion((v) => v + 1)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  })

  // ---- Drawing ----
  // In-progress drag-to-create range, drawn as a preview.
  const [createPreview, setCreatePreview] = createSignal<{ start: number; end: number } | null>(
    null
  )
  const [hoverCursor, setHoverCursor] = createSignal('crosshair')

  function draw(): void {
    if (!canvas) return
    sizeCanvas(canvas, canvasWrap)
    const ctx = canvas.getContext('2d')
    if (!ctx || canvas.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.width / dpr
    const height = canvas.height / dpr
    const vs = viewStart()
    const ve = viewEnd()
    const span = ve - vs
    const xOf = (t: number): number => ((t - vs) / span) * width

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    drawRuler(ctx, width, height, vs, ve)

    const waveTop = RULER_H
    const waveH = height - RULER_H
    const list = slices()
    const selId = selectedId()

    // Slice backgrounds
    list.forEach((s, i) => {
      const x1 = xOf(s.start)
      const x2 = xOf(s.end)
      if (x2 < 0 || x1 > width) return
      ctx.fillStyle = sliceColor(i)
      ctx.globalAlpha = s.id === selId ? 0.28 : 0.13
      ctx.fillRect(x1, waveTop, x2 - x1, waveH)
    })
    ctx.globalAlpha = 1

    // Pending drag-to-create preview
    const pending = createPreview()
    if (pending) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(xOf(pending.start), waveTop, xOf(pending.end) - xOf(pending.start), waveH)
    }

    // Center line + waveform
    ctx.strokeStyle = '#2a2c30'
    ctx.beginPath()
    ctx.moveTo(0, waveTop + waveH / 2 + 0.5)
    ctx.lineTo(width, waveTop + waveH / 2 + 0.5)
    ctx.stroke()
    if (wave)
      drawWaveform(ctx, wave, Math.floor(width), waveTop, waveH, vs, ve, (t) => {
        for (let i = list.length - 1; i >= 0; i--) {
          if (t >= list[i].start && t < list[i].end) return sliceColor(i)
        }
        return 'rgba(255,255,255,0.35)'
      })

    // Slice edges + labels
    list.forEach((s, i) => {
      const x1 = xOf(s.start)
      const x2 = xOf(s.end)
      if (x2 < 0 || x1 > width) return
      const color = sliceColor(i)
      const selected = s.id === selId
      ctx.strokeStyle = color
      ctx.lineWidth = selected ? 2 : 1
      ctx.beginPath()
      ctx.moveTo(x1, waveTop)
      ctx.lineTo(x1, height)
      ctx.moveTo(x2, waveTop)
      ctx.lineTo(x2, height)
      ctx.stroke()
      const label = String(i + 1).padStart(2, '0')
      ctx.font = 'bold 10px JetBrains Mono, monospace'
      const lw = ctx.measureText(label).width + 8
      const lx = Math.max(0, x1)
      ctx.fillStyle = color
      ctx.fillRect(lx, waveTop, lw, 15)
      ctx.fillStyle = '#111214'
      ctx.fillText(label, lx + 4, waveTop + 8)
    })
    ctx.lineWidth = 1

    // Mark anchor (live marking in progress)
    const anchor = markAnchor()
    if (anchor !== null) {
      const ax = xOf(anchor)
      ctx.strokeStyle = '#facc15'
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(ax, waveTop)
      ctx.lineTo(ax, height)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Playhead
    const px = Math.round(xOf(playhead()))
    if (px >= 0 && px <= width) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, height)
      ctx.stroke()
    }

    ctx.restore()
  }

  function drawOverview(): void {
    if (!overview) return
    sizeCanvas(overview, overviewWrap)
    const ctx = overview.getContext('2d')
    if (!ctx || overview.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const width = overview.width / dpr
    const height = overview.height / dpr
    const dur = duration()
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)
    if (dur > 0) {
      const xOf = (t: number): number => (t / dur) * width
      slices().forEach((s, i) => {
        ctx.fillStyle = sliceColor(i)
        ctx.globalAlpha = 0.3
        ctx.fillRect(xOf(s.start), 0, Math.max(1, xOf(s.end) - xOf(s.start)), height)
      })
      ctx.globalAlpha = 1
      if (wave)
        drawWaveform(ctx, wave, Math.floor(width), 0, height, 0, dur, () => 'rgba(255,255,255,0.3)')
      const v1 = xOf(viewStart())
      const v2 = xOf(viewEnd())
      ctx.fillStyle = 'rgba(0,122,204,0.18)'
      ctx.fillRect(v1, 0, v2 - v1, height)
      ctx.strokeStyle = '#007acc'
      ctx.strokeRect(v1 + 0.5, 0.5, Math.max(1, v2 - v1 - 1), height - 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(xOf(playhead())), 0, 1, height)
    }
    ctx.restore()
  }

  createEffect(() => {
    dataVersion()
    slices()
    selectedId()
    viewStart()
    viewEnd()
    playhead()
    markAnchor()
    createPreview()
    draw()
    drawOverview()
  })

  // ---- Pointer interaction on the main canvas ----
  type DragMode =
    | { kind: 'create'; anchor: number; startX: number; moved: boolean }
    | {
        kind: 'move'
        id: number
        grabTime: number
        orig: Slice
        startX: number
        moved: boolean
        before: Slice[]
      }
    | { kind: 'resize'; id: number; edge: 'start' | 'end'; before: Slice[] }
  let drag: DragMode | null = null

  function timeAtX(clientX: number): number {
    if (!canvasWrap) return 0
    const rect = canvasWrap.getBoundingClientRect()
    const frac = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0
    return viewStart() + frac * (viewEnd() - viewStart())
  }

  function hitTest(clientX: number): { id: number; part: 'start' | 'end' | 'body' } | null {
    if (!canvasWrap) return null
    const rect = canvasWrap.getBoundingClientRect()
    const x = clientX - rect.left
    const span = viewEnd() - viewStart()
    const xOf = (t: number): number => ((t - viewStart()) / span) * rect.width
    // Selected slice wins so overlapping slices stay editable.
    const list = [...slices()].sort((a, b) =>
      a.id === selectedId() ? -1 : b.id === selectedId() ? 1 : 0
    )
    for (const s of list) {
      if (Math.abs(x - xOf(s.end)) <= EDGE_HIT_PX) return { id: s.id, part: 'end' }
      if (Math.abs(x - xOf(s.start)) <= EDGE_HIT_PX) return { id: s.id, part: 'start' }
    }
    for (const s of list) {
      if (x > xOf(s.start) && x < xOf(s.end)) return { id: s.id, part: 'body' }
    }
    return null
  }

  function onCanvasMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || !buffer) return
    const hit = hitTest(e.clientX)
    const t = timeAtX(e.clientX)
    if (hit && hit.part !== 'body') {
      setSelectedId(hit.id)
      drag = { kind: 'resize', id: hit.id, edge: hit.part, before: slices() }
    } else if (hit) {
      const orig = slices().find((s) => s.id === hit.id)!
      setSelectedId(hit.id)
      drag = {
        kind: 'move',
        id: hit.id,
        grabTime: t,
        orig,
        startX: e.clientX,
        moved: false,
        before: slices()
      }
    } else {
      drag = { kind: 'create', anchor: t, startX: e.clientX, moved: false }
    }
    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
  }

  function onCanvasHover(e: MouseEvent): void {
    if (drag) return
    const hit = hitTest(e.clientX)
    setHoverCursor(hit ? (hit.part === 'body' ? 'grab' : 'ew-resize') : 'crosshair')
  }

  function onWindowMouseMove(e: MouseEvent): void {
    if (!drag) return
    const t = timeAtX(e.clientX)
    const dur = duration()
    if (drag.kind === 'create') {
      if (Math.abs(e.clientX - drag.startX) > DRAG_THRESHOLD_PX) drag.moved = true
      if (drag.moved)
        setCreatePreview({ start: Math.min(drag.anchor, t), end: Math.max(drag.anchor, t) })
    } else if (drag.kind === 'move') {
      if (Math.abs(e.clientX - drag.startX) > DRAG_THRESHOLD_PX) drag.moved = true
      if (!drag.moved) return
      const len = drag.orig.end - drag.orig.start
      const start = Math.min(Math.max(0, drag.orig.start + (t - drag.grabTime)), dur - len)
      updateSlice(drag.id, { start, end: start + len }, false)
    } else {
      const id = drag.id
      const s = slices().find((x) => x.id === id)
      if (!s) return
      if (drag.edge === 'start') {
        updateSlice(s.id, { start: Math.min(Math.max(0, t), s.end - MIN_SLICE_SEC) }, false)
      } else {
        updateSlice(s.id, { end: Math.max(Math.min(dur, t), s.start + MIN_SLICE_SEC) }, false)
      }
    }
  }

  function onWindowMouseUp(e: MouseEvent): void {
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
    const d = drag
    drag = null
    setCreatePreview(null)
    if (!d) return
    const t = timeAtX(e.clientX)

    if (d.kind === 'create') {
      if (d.moved && Math.abs(t - d.anchor) >= MIN_SLICE_SEC) {
        const s = addSlice(d.anchor, t)
        playSlice(s)
      } else {
        // Plain click on empty space: deselect and move the playhead there.
        setSelectedId(null)
        setPlayhead(t)
        if (playing()) playFrom(t)
      }
    } else if (d.kind === 'move') {
      if (d.moved) {
        pushHistory(d.before)
      } else {
        const s = slices().find((x) => x.id === d.id)
        if (s) playSlice(s)
      }
    } else if (d.before !== slices()) {
      pushHistory(d.before)
    }
  }

  function onCanvasWheel(e: WheelEvent): void {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      zoomAt(timeAtX(e.clientX), e.deltaY > 0 ? 1.25 : 0.8)
    } else {
      const span = viewEnd() - viewStart()
      const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / 600
      setView(viewStart() + delta * span, viewEnd() + delta * span)
    }
  }

  // ---- Overview: click/drag to pan ----
  function onOverviewMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return
    const panTo = (clientX: number): void => {
      if (!overviewWrap) return
      const rect = overviewWrap.getBoundingClientRect()
      const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration()
      const span = viewEnd() - viewStart()
      setView(t - span / 2, t + span / 2)
    }
    panTo(e.clientX)
    const move = (ev: MouseEvent): void => panTo(ev.clientX)
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
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
      exportSlices()
      return
    }
    if (typing) {
      if (e.key === 'Enter') (active as HTMLInputElement).blur()
      return
    }
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      redo()
    } else if (e.code === 'Space') {
      e.preventDefault()
      togglePlay()
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const id = selectedId()
      if (id !== null) {
        e.preventDefault()
        deleteSlice(id)
      }
    } else if (e.key.toLowerCase() === 'm' && !mod) {
      e.preventDefault()
      mark()
    } else if (e.key.toLowerCase() === 'l' && !mod) {
      e.preventDefault()
      setLoopEnabled((v) => !v)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const list = slices()
      if (list.length === 0) return
      const i = sliceIndex(selectedId() ?? -1)
      const next =
        e.key === 'ArrowRight' ? (i < 0 ? 0 : Math.min(list.length - 1, i + 1)) : Math.max(0, i - 1)
      playSlice(list[next])
      const s = list[next]
      if (s.start < viewStart() || s.end > viewEnd()) zoomToSlice(s)
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
      draw()
      drawOverview()
    })
    if (canvasWrap) resizeObserver.observe(canvasWrap)
    if (overviewWrap) resizeObserver.observe(overviewWrap)
    // Wheel must be non-passive to stop the page from scrolling while zooming.
    canvasWrap?.addEventListener('wheel', onCanvasWheel, { passive: false })
  })

  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
    canvasWrap?.removeEventListener('wheel', onCanvasWheel)
    resizeObserver?.disconnect()
    stopSource()
    void audioCtx?.close()
  })

  function editBound(
    s: Slice,
    edge: 'start' | 'end',
    value: string,
    input: HTMLInputElement
  ): void {
    const t = parseTimeInput(value)
    if (t === null) {
      input.value = formatTime(s[edge])
      return
    }
    const range =
      edge === 'start' ? clampRange(t, s.end, duration()) : clampRange(s.start, t, duration())
    updateSlice(s.id, range)
  }

  const totalSliceSec = (): number => slices().reduce((n, s) => n + (s.end - s.start), 0)

  return (
    <div id="slicer-editor" class="flex flex-col min-h-0 select-none">
      {/* Toolbar */}
      <div
        id="slicer-toolbar"
        class="h-12 px-3.5 flex items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-panel-header)] shrink-0"
      >
        <Button
          id="slicer-play-btn"
          variant="primary"
          size="sm"
          onClick={togglePlay}
          disabled={loading() || !!loadError()}
          icon={playing() ? <Pause size={14} /> : <Play size={14} />}
          title={
            playing()
              ? 'Stop (Space)'
              : selectedSlice()
                ? 'Play selected slice (Space)'
                : 'Play from cursor (Space)'
          }
        >
          {playing() ? 'Stop' : 'Play'}
        </Button>
        <IconButton
          id="slicer-loop-btn"
          size="sm"
          active={loopEnabled()}
          onClick={() => setLoopEnabled((v) => !v)}
          tooltip="Loop slice playback (L)"
        >
          <Repeat size={14} />
        </IconButton>
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
            id="slicer-volume-slider"
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
        <span id="slicer-time" class="font-mono text-md tabular-nums text-[var(--text-muted)] px-2">
          <span class="text-[var(--accent-color)]">{formatTime(playhead())}</span> /{' '}
          {formatTime(duration())}
        </span>

        <div class="w-px h-6 bg-[var(--border-color)] mx-1" />

        <Button
          id="slicer-mark-btn"
          size="sm"
          active={markAnchor() !== null}
          onClick={mark}
          disabled={loading() || !!loadError()}
          icon={<Flag size={13} />}
          title="Mark slice start, then press again to mark its end — works while playing (M)"
        >
          {markAnchor() !== null ? 'Mark End' : 'Mark'}
        </Button>

        <div class="flex items-center gap-1">
          <IconButton size="sm" onClick={undo} disabled={undoCount() === 0} tooltip="Undo (Ctrl+Z)">
            <Undo2 size={14} />
          </IconButton>
          <IconButton
            size="sm"
            onClick={redo}
            disabled={redoStack().length === 0}
            tooltip="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
          </IconButton>
        </div>

        <div class="w-px h-6 bg-[var(--border-color)] mx-1" />

        <div class="flex items-center gap-1">
          <IconButton size="sm" onClick={() => zoomCenter(0.8)} tooltip="Zoom in (+ / Ctrl+Wheel)">
            <ZoomIn size={14} />
          </IconButton>
          <IconButton size="sm" onClick={() => zoomCenter(1.25)} tooltip="Zoom out (-)">
            <ZoomOut size={14} />
          </IconButton>
          <IconButton size="sm" onClick={zoomToFit} tooltip="Fit whole sound (0)">
            <Maximize2 size={14} />
          </IconButton>
        </div>

        <div class="flex-1" />

        {/* Auto-detect */}
        <div id="slicer-detect" class="flex items-center gap-2 text-md">
          <label
            class="text-[var(--text-muted)]"
            title="Anything quieter than this counts as silence"
          >
            Threshold
          </label>
          <input
            id="slicer-threshold"
            type="range"
            min="-80"
            max="-10"
            step="1"
            value={thresholdDb()}
            onInput={(e) => setThresholdDb(parseInt(e.currentTarget.value, 10))}
            class="w-24 accent-[#007acc] h-2 cursor-pointer"
          />
          <span class="font-mono tabular-nums w-16 whitespace-nowrap text-[var(--text-main)]">
            {thresholdDb()} dB
          </span>
          <label class="text-[var(--text-muted)]" title="Shortest silence that splits two slices">
            Gap
          </label>
          <input
            id="slicer-min-gap"
            type="range"
            min="20"
            max="1000"
            step="10"
            value={minGapMs()}
            onInput={(e) => setMinGapMs(parseInt(e.currentTarget.value, 10))}
            class="w-20 accent-[#007acc] h-2 cursor-pointer"
          />
          <span class="font-mono tabular-nums w-16 whitespace-nowrap text-[var(--text-main)]">
            {minGapMs()} ms
          </span>
          <Button
            id="slicer-detect-btn"
            size="sm"
            onClick={autoDetect}
            disabled={loading() || !!loadError()}
            icon={<WandSparkles size={13} />}
            title="Replace all slices with sounds found between silences (undoable)"
          >
            Auto-Detect
          </Button>
        </div>
      </div>

      {/* Waveform */}
      <div class="px-3.5 pt-3 flex flex-col gap-2 shrink-0">
        <div
          id="slicer-canvas-container"
          ref={canvasWrap}
          class="relative w-full h-64 bg-[#1e2022] border border-[#1c1d1f] rounded-[3px] overflow-hidden"
          style={{ cursor: hoverCursor() }}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasHover}
        >
          <canvas id="slicer-canvas" ref={canvas} class="w-full h-full block" />
          <Show when={loading()}>
            <div class="absolute inset-0 flex items-center justify-center gap-2 bg-[#1e2022]/80 text-md text-[#8b949e]">
              <RefreshCw size={16} class="animate-spin text-[#007acc]" />
              <span>Decoding audio…</span>
            </div>
          </Show>
          <Show when={loadError()}>
            <div class="absolute inset-0 flex items-center justify-center text-md text-red-400 px-6 text-center">
              Couldn't decode this sound: {loadError()}
            </div>
          </Show>
        </div>
        <div
          id="slicer-overview"
          ref={overviewWrap}
          class="relative w-full h-9 bg-[#1a1b1e] border border-[#1c1d1f] rounded-[3px] overflow-hidden cursor-pointer"
          onMouseDown={onOverviewMouseDown}
          title="Click or drag to pan"
        >
          <canvas ref={overview} class="w-full h-full block" />
        </div>
        <div class="flex items-center gap-3 text-md text-[var(--text-muted)] flex-wrap">
          <span>
            <Kbd>Drag</Kbd> empty space to add
          </span>
          <span>
            <Kbd>Drag</Kbd> edges to trim, middle to move
          </span>
          <span>
            <Kbd>M</Kbd> mark start/end while playing
          </span>
          <span>
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> step slices
          </span>
          <span>
            <Kbd>Del</Kbd> remove
          </span>
          <span>
            <Kbd>Ctrl</Kbd>+<Kbd>Wheel</Kbd> zoom
          </span>
        </div>
      </div>

      {/* Slice list */}
      <div class="px-3.5 py-3 flex flex-col gap-2 min-h-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 font-medium text-[var(--text-main)]">
            <span>Slices</span>
            <Badge variant="accent">{slices().length}</Badge>
            <Show when={slices().length > 0}>
              <span class="font-mono text-md text-[var(--text-muted)]">
                {formatTime(totalSliceSec())} total
              </span>
            </Show>
          </div>
          <div class="flex items-center gap-2">
            <Button
              id="slicer-clear-btn"
              variant="ghost"
              size="sm"
              onClick={clearSlices}
              disabled={slices().length === 0}
              icon={<Trash2 size={13} />}
            >
              Clear All
            </Button>
            <Show when={props.onEffects}>
              <Button
                id="slicer-effects-btn"
                size="sm"
                onClick={effectsForSlices}
                disabled={slices().length === 0}
                icon={<SlidersHorizontal size={13} />}
                title="Add effects to every slice, then drag or export them"
              >
                Effects…
              </Button>
            </Show>
            <Button
              id="slicer-export-btn"
              variant="primary"
              size="sm"
              onClick={exportSlices}
              disabled={slices().length === 0}
              icon={<Download size={13} />}
              title="Export each slice as its own file (Ctrl+E)"
            >
              Export {slices().length} {slices().length === 1 ? 'Slice' : 'Slices'}…
            </Button>
          </div>
        </div>

        <div
          id="slicer-list"
          class="max-h-[28vh] min-h-[96px] overflow-y-auto dcc-scroll bg-black/20 border border-[var(--border-color)] rounded-[3px]"
        >
          <Show
            when={slices().length > 0}
            fallback={
              <div class="h-24 flex items-center justify-center text-md text-[var(--text-muted)]">
                No slices yet. Drag across the waveform, press M while playing, or use Auto-Detect.
              </div>
            }
          >
            <div class="grid grid-cols-[36px_minmax(200px,1fr)_120px_120px_80px_72px] gap-2 px-3 py-1.5 text-md text-[var(--text-muted)] border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-panel)]">
              <span>#</span>
              <span>Output name</span>
              <span>Start</span>
              <span>End</span>
              <span class="text-right">Length</span>
              <span />
            </div>
            <For each={slices()}>
              {(s, i) => (
                <div
                  class={`grid grid-cols-[36px_minmax(200px,1fr)_120px_120px_80px_72px] gap-2 items-center px-3 py-1 border-b border-white/5 last:border-b-0 cursor-pointer ${
                    s.id === selectedId() ? 'bg-[#007acc]/15' : 'hover:bg-white/5'
                  }`}
                  onClick={() => {
                    setSelectedId(s.id)
                    if (s.start < viewStart() || s.end > viewEnd()) zoomToSlice(s)
                  }}
                  onDblClick={() => playSlice(s)}
                >
                  <span class="font-mono text-md font-bold" style={{ color: sliceColor(i()) }}>
                    {String(i() + 1).padStart(2, '0')}
                  </span>
                  <input
                    type="text"
                    value={s.name}
                    placeholder={autoSliceName(stem, i(), slices().length)}
                    onChange={(e) => updateSlice(s.id, { name: e.currentTarget.value })}
                    onClick={(e) => e.stopPropagation()}
                    class="h-7 px-2 bg-[#1e2022] border border-[#1c1d1f] focus:border-[#007acc] rounded-[3px] font-mono text-md text-[#f0f3f6] placeholder:text-[#8b949e]/60 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={formatTime(s.start)}
                    onChange={(e) => editBound(s, 'start', e.currentTarget.value, e.currentTarget)}
                    onClick={(e) => e.stopPropagation()}
                    class="h-7 px-2 bg-[#1e2022] border border-[#1c1d1f] focus:border-[#007acc] rounded-[3px] font-mono text-md tabular-nums text-[#f0f3f6] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={formatTime(s.end)}
                    onChange={(e) => editBound(s, 'end', e.currentTarget.value, e.currentTarget)}
                    onClick={(e) => e.stopPropagation()}
                    class="h-7 px-2 bg-[#1e2022] border border-[#1c1d1f] focus:border-[#007acc] rounded-[3px] font-mono text-md tabular-nums text-[#f0f3f6] focus:outline-none"
                  />
                  <span class="font-mono text-md tabular-nums text-right text-[var(--text-muted)]">
                    {formatTime(s.end - s.start)}
                  </span>
                  <div class="flex items-center justify-end gap-1">
                    <IconButton
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (playing() && selectedId() === s.id) stop()
                        else playSlice(s)
                      }}
                      tooltip="Play slice"
                    >
                      {playing() && selectedId() === s.id ? (
                        <Pause size={13} />
                      ) : (
                        <Play size={13} />
                      )}
                    </IconButton>
                    <IconButton
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSlice(s.id)
                      }}
                      tooltip="Remove slice (Del)"
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}
