import { createEffect, createSignal, onCleanup, onMount, untrack } from 'solid-js'
import type { SoundRow } from '../../../preload/index'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { showToast } from './ui/Toast'
import {
  PlayIcon,
  PauseIcon,
  DownloadIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
  FileAudioIcon,
  RefreshCwIcon,
  GripVerticalIcon,
  ScissorsIcon,
  RepeatIcon,
  SlidersIcon
} from './icons'

export interface WaveformApi {
  togglePlay: () => void
  play: () => void
  pause: () => void
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00.00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 100)
  return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

function formatRegionSec(s: number): string {
  if (!isFinite(s)) return '0.00s'
  return `${s.toFixed(2)}s`
}

const DRAG_THRESHOLD_PX = 4
// Shortest selection treated as a playable/loopable region, in seconds.
const MIN_REGION_SEC = 0.03

export default function WaveformPreview(props: {
  row: SoundRow | null
  selectedCount?: number
  onApi?: (api: WaveformApi) => void
  onExportRequest?: (region: { start: number; end: number } | null) => void
  onSliceRequest?: (region: { start: number; end: number } | null) => void
  onLoopRequest?: (region: { start: number; end: number } | null) => void
  onEffectsRequest?: (region: { start: number; end: number } | null) => void
}) {
  let canvas: HTMLCanvasElement | undefined
  let canvasWrap: HTMLDivElement | undefined
  let audioEl: HTMLAudioElement | undefined

  const [peaks, setPeaks] = createSignal<Float32Array | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [playing, setPlaying] = createSignal(false)
  const [progress, setProgress] = createSignal(0)
  const [duration, setDuration] = createSignal(0)
  const [volume, setVolume] = createSignal(1)
  const [muted, setMuted] = createSignal(false)

  // Selected playback region, in seconds. Null = whole file.
  const [selStart, setSelStart] = createSignal<number | null>(null)
  const [selEnd, setSelEnd] = createSignal<number | null>(null)
  let dragStartX = 0
  let dragStartTime = 0
  let dragging = false
  let dragMoved = false

  // Bumped when a region is committed or cleared (not on every mousemove while dragging).
  const [regionVersion, setRegionVersion] = createSignal(0)
  const bumpRegion = (): number => setRegionVersion((v) => v + 1)

  // The selected region rendered to a file in the drag folder, ready for drag-out.
  const [render, setRender] = createSignal<{ path: string; name: string } | null>(null)
  const [rendering, setRendering] = createSignal(false)
  let renderToken = 0
  let renderTimer: ReturnType<typeof setTimeout> | undefined

  let audioCtx: AudioContext | undefined
  let currentToken = 0
  let rafId: number | undefined
  let loopTimer: ReturnType<typeof setTimeout> | undefined
  let lastLoadedPath = ''
  let loadDebounceTimer: ReturnType<typeof setTimeout> | undefined
  let currentAbortController: AbortController | null = null

  function getCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  }

  async function loadWaveform(row: SoundRow): Promise<void> {
    const token = ++currentToken
    if (currentAbortController) {
      currentAbortController.abort()
    }
    const abortCtrl = new AbortController()
    currentAbortController = abortCtrl

    setLoading(true)
    setPeaks(null)
    try {
      const res = await fetch(window.api.audioUrl(row.path), { signal: abortCtrl.signal })
      const arrayBuffer = await res.arrayBuffer()
      if (token !== currentToken) return
      const audioBuffer = await getCtx().decodeAudioData(arrayBuffer)
      if (token !== currentToken) return
      if (audioBuffer && isFinite(audioBuffer.duration) && audioBuffer.duration > 0) {
        setDuration(audioBuffer.duration)
      }
      setPeaks(computePeaks(audioBuffer, 500))
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      if (token === currentToken) setPeaks(null)
    } finally {
      if (token === currentToken) setLoading(false)
    }
  }

  function computePeaks(buffer: AudioBuffer, bucketCount: number): Float32Array {
    const data = buffer.getChannelData(0)
    const bucketSize = Math.max(1, Math.floor(data.length / bucketCount))
    const peaks = new Float32Array(bucketCount)
    for (let i = 0; i < bucketCount; i++) {
      const start = i * bucketSize
      let max = 0
      for (let j = start; j < start + bucketSize && j < data.length; j++) {
        const v = Math.abs(data[j])
        if (v > max) max = v
      }
      peaks[i] = max
    }
    return peaks
  }

  function resizeCanvas(): void {
    if (!canvas || !canvasWrap) return
    const rect = canvasWrap.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const targetWidth = Math.floor(rect.width * dpr)
    const targetHeight = Math.floor(rect.height * dpr)

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth
      canvas.height = targetHeight
      draw()
    }
  }

  function draw(): void {
    if (!canvas) return
    if (canvas.width === 0 || canvas.height === 0) {
      resizeCanvas()
      if (canvas.width === 0 || canvas.height === 0) return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.width / dpr
    const height = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const p = peaks()
    const dur = duration() || props.row?.duration || 0
    const mid = height / 2

    // Baseline axis line
    ctx.strokeStyle = '#22222a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, mid)
    ctx.lineTo(width, mid)
    ctx.stroke()

    const start = selStart()
    const end = selEnd()
    const hasSel =
      start !== null && end !== null && dur > 0 && Math.abs(end - start) >= MIN_REGION_SEC

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#007acc'

    // Draw selection background
    if (hasSel) {
      const x1 = (Math.min(start!, end!) / dur) * width
      const x2 = (Math.max(start!, end!) / dur) * width
      ctx.fillStyle = 'rgba(0, 122, 204, 0.25)'
      ctx.fillRect(x1, 0, x2 - x1, height)
    }

    const playedFrac = dur > 0 ? progress() / dur : 0

    // Draw bars if peaks are computed
    if (p && dur > 0) {
      const barWidth = width / p.length
      for (let i = 0; i < p.length; i++) {
        const h = Math.max(2, p[i] * (height * 0.85))
        const x = i * barWidth
        const barTime = (i / p.length) * dur
        const inSel = hasSel && barTime >= Math.min(start!, end!) && barTime <= Math.max(start!, end!)
        const played = i / p.length <= playedFrac

        if (played) {
          ctx.fillStyle = accentColor
        } else if (inSel) {
          ctx.fillStyle = accentColor
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
        }

        const w = Math.max(1, barWidth - 1)
        ctx.fillRect(x, mid - h / 2, w, h)
      }
    }

    // Draw selection borders
    if (hasSel) {
      const x1 = (Math.min(start!, end!) / dur) * width
      const x2 = (Math.max(start!, end!) / dur) * width
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x1, 0)
      ctx.lineTo(x1, height)
      ctx.moveTo(x2, 0)
      ctx.lineTo(x2, height)
      ctx.stroke()
    }

    // Draw active playhead needle
    if (dur > 0) {
      const playheadX = Math.round(playedFrac * width)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()

      // Small cursor handle at top
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(playheadX, 3.5, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  createEffect(() => {
    peaks()
    progress()
    duration()
    selStart()
    selEnd()
    draw()
  })

  createEffect(() => {
    const row = props.row
    if (!row) {
      lastLoadedPath = ''
      clearTimeout(loadDebounceTimer)
      if (currentAbortController) {
        currentAbortController.abort()
        currentAbortController = null
      }
      setPeaks(null)
      setDuration(0)
      setSelStart(null)
      setSelEnd(null)
      bumpRegion()
      cancelAnimationFrame(rafId!)
      if (audioEl) {
        audioEl.pause()
        // src = '' resolves to the page URL and triggers a failed load.
        audioEl.removeAttribute('src')
        audioEl.load()
        setProgress(0)
        setPlaying(false)
      }
      return
    }

    if (row.path === lastLoadedPath) {
      return
    }

    lastLoadedPath = row.path
    setDuration(row.duration ?? 0)
    setSelStart(null)
    setSelEnd(null)
    bumpRegion()
    cancelAnimationFrame(rafId!)

    if (audioEl) {
      audioEl.pause()
      audioEl.src = window.api.audioUrl(row.path)
      setProgress(0)
      setPlaying(false)
    }

    clearTimeout(loadDebounceTimer)
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }

    loadDebounceTimer = setTimeout(() => {
      loadWaveform(row)
    }, 50)
  })

  function regionBounds(): { start: number; end: number } | null {
    const s = selStart()
    const e = selEnd()
    if (s === null || e === null) return null
    const start = Math.min(s, e)
    const end = Math.max(s, e)
    if (end - start < MIN_REGION_SEC) return null
    return { start, end }
  }

  // Region drag-out: the region is written to the persistent drag folder at full
  // bit depth, so it's prepared as soon as a region is committed.
  createEffect(() => {
    const row = props.row
    regionVersion()
    const region = untrack(regionBounds)
    clearTimeout(renderTimer)
    const token = ++renderToken
    if (!row || !region) {
      setRender(null)
      setRendering(false)
      return
    }
    setRendering(true)
    renderTimer = setTimeout(async () => {
      try {
        const r = await window.api.renderProcessed({
          sourcePath: row.path,
          start: region.start,
          end: region.end
        })
        if (token === renderToken) setRender({ path: r.path, name: r.name })
      } catch (err) {
        if (token !== renderToken) return
        setRender(null)
        showToast({
          type: 'error',
          title: 'Could not prepare region',
          message: err instanceof Error ? err.message.slice(0, 200) : String(err)
        })
      } finally {
        if (token === renderToken) setRendering(false)
      }
    }, 150)
  })

  function onAudioLoaded(): void {
    if (audioEl && isFinite(audioEl.duration) && audioEl.duration > 0) {
      setDuration(audioEl.duration)
    }
  }

  function onRegionDragStart(e: DragEvent): void {
    e.preventDefault()
    const r = render()
    if (r && !rendering()) window.api.startDragRendered([r])
  }

  // Starts playback, snapping into the selected region first if the playhead
  // sits outside it (e.g. after the file ended, or paused before the region).
  function startPlayback(): void {
    if (!audioEl) return
    const region = regionBounds()
    if (
      region &&
      (audioEl.ended || audioEl.currentTime < region.start || audioEl.currentTime >= region.end)
    ) {
      audioEl.currentTime = region.start
    }
    audioEl.play().catch(() => {})
  }

  function togglePlay(): void {
    if (!audioEl || !props.row) return
    if (audioEl.paused) {
      startPlayback()
    } else {
      audioEl.pause()
    }
  }

  function timeFromEvent(e: MouseEvent): number {
    if (!canvasWrap) return 0
    const rect = canvasWrap.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const dur = duration() || props.row?.duration || 0
    return frac * dur
  }

  function onPointerDown(e: MouseEvent): void {
    if (e.button !== 0) return
    const dur = duration() || props.row?.duration || 0
    if (!canvas || dur <= 0) return
    if (duration() <= 0 && dur > 0) setDuration(dur)
    dragging = true
    dragMoved = false
    dragStartX = e.clientX
    dragStartTime = timeFromEvent(e)
    setSelStart(dragStartTime)
    setSelEnd(dragStartTime)
    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
  }

  function onPointerMove(e: MouseEvent): void {
    if (!dragging) return
    if (Math.abs(e.clientX - dragStartX) > DRAG_THRESHOLD_PX) dragMoved = true
    setSelEnd(timeFromEvent(e))
  }

  function onPointerUp(e: MouseEvent): void {
    dragging = false
    window.removeEventListener('mousemove', onPointerMove)
    window.removeEventListener('mouseup', onPointerUp)
    if (!audioEl) return

    const endTime = timeFromEvent(e)
    const isDrag = dragMoved && Math.abs(endTime - dragStartTime) >= MIN_REGION_SEC

    if (!isDrag) {
      // plain click: clear any region and seek/play from that point
      setSelStart(null)
      setSelEnd(null)
      bumpRegion()
      audioEl.currentTime = endTime
      audioEl.play().catch(() => {})
    } else {
      const s = Math.min(dragStartTime, endTime)
      const eTime = Math.max(dragStartTime, endTime)
      setSelStart(s)
      setSelEnd(eTime)
      bumpRegion()
      audioEl.currentTime = s
      audioEl.play().catch(() => {})
      scheduleLoopCheck()
    }
  }

  // Loops playback back to the region start once it reaches the region end.
  // Called from BOTH the native 'timeupdate' event (fires reliably even when
  // the window is unfocused/minimized/backgrounded) and the rAF loop (fires
  // only while the window is visible, for smooth playhead animation). rAF
  // alone used to be the only place this ran — browsers throttle or fully
  // suspend rAF when the app isn't the focused/visible window, so playback
  // would silently escape the region and keep going whenever the user
  // alt-tabbed away or the window lost focus. Returns true if it looped.
  function enforceRegionLoop(): boolean {
    if (!audioEl) return false
    const region = regionBounds()
    if (region && audioEl.currentTime >= region.end) {
      audioEl.currentTime = region.start
      setProgress(region.start)
      scheduleLoopCheck()
      return true
    }
    return false
  }

  // Precise loop point: a timer set for exactly when the playhead reaches the
  // region end. rAF only checks every ~16ms (and stops when the window is
  // hidden), timeupdate only every ~250ms, so relying on them alone lets
  // playback audibly overshoot the region end before looping. Re-armed on
  // every play/seek/loop; enforceRegionLoop re-reads the region when it fires,
  // so a stale timer after the region changes is harmless.
  function scheduleLoopCheck(): void {
    clearTimeout(loopTimer)
    if (!audioEl || audioEl.paused) return
    const region = regionBounds()
    if (!region) return
    const remaining = (region.end - audioEl.currentTime) / (audioEl.playbackRate || 1)
    loopTimer = setTimeout(
      () => {
        if (!enforceRegionLoop()) scheduleLoopCheck()
      },
      Math.max(0, remaining * 1000)
    )
  }

  function playheadTick(): void {
    if (!audioEl) return

    if (!audioEl.paused && !audioEl.ended) {
      if (!enforceRegionLoop()) {
        setProgress(audioEl.currentTime)
      }
      rafId = requestAnimationFrame(playheadTick)
    }
  }

  function onAudioPlay(): void {
    setPlaying(true)
    cancelAnimationFrame(rafId!)
    rafId = requestAnimationFrame(playheadTick)
  }

  function onAudioPause(): void {
    setPlaying(false)
    cancelAnimationFrame(rafId!)
    clearTimeout(loopTimer)
    if (audioEl) setProgress(audioEl.currentTime)
  }

  function onAudioEnded(): void {
    const region = regionBounds()
    if (region && audioEl) {
      // Region runs to the very end of the file: the element hits 'ended'
      // before any region-end check can fire, so loop from here instead.
      audioEl.currentTime = region.start
      setProgress(region.start)
      audioEl.play().catch(() => {})
      return
    }
    setPlaying(false)
    cancelAnimationFrame(rafId!)
    setProgress(0)
  }

  function onAudioTimeUpdate(): void {
    if (!audioEl) return
    // Always enforce the loop here regardless of play state or window focus
    // — this is the reliable path. If rAF is also running (window focused)
    // it'll usually win the race for a snappier-looking loop; this is just
    // the backstop that keeps working when rAF can't.
    if (enforceRegionLoop()) return
    if (audioEl.paused || audioEl.ended) {
      setProgress(audioEl.currentTime)
    }
  }

  function updateVolume(val: number): void {
    setVolume(val)
    // Dragging the slider while muted should unmute, otherwise the slider
    // moves but playback stays silent.
    if (muted() && val > 0) setMuted(false)
    if (audioEl) {
      audioEl.volume = muted() ? 0 : val
    }
  }

  function toggleMute(): void {
    const next = !muted()
    setMuted(next)
    if (audioEl) {
      audioEl.volume = next ? 0 : volume()
    }
  }

  function requestExport(): void {
    if (!props.row && (!props.selectedCount || props.selectedCount <= 0)) return
    props.onExportRequest?.(regionBounds())
  }

  let resizeObserver: ResizeObserver | undefined

  onMount(() => {
    props.onApi?.({
      togglePlay,
      play: startPlayback,
      pause: () => {
        if (audioEl) {
          audioEl.pause()
          cancelAnimationFrame(rafId!)
        }
      }
    })

    if (canvasWrap) {
      resizeCanvas()
      resizeObserver = new ResizeObserver(() => resizeCanvas())
      resizeObserver.observe(canvasWrap)
    }
  })

  onCleanup(() => {
    cancelAnimationFrame(rafId!)
    clearTimeout(loopTimer)
    clearTimeout(loadDebounceTimer)
    clearTimeout(renderTimer)
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    audioCtx?.close()
    resizeObserver?.disconnect()
    window.removeEventListener('mousemove', onPointerMove)
    window.removeEventListener('mouseup', onPointerUp)
  })

  const region = (): { start: number; end: number } | null => regionBounds()

  return (
    <div id="waveform-preview-dock" class="bg-[#26282b] border-t border-[#1c1d1f] flex flex-col shrink-0 select-none z-10">
      {/* Top Waveform Header Bar */}
      <div id="waveform-header-bar" class="h-11 min-h-[44px] px-3.5 bg-[#26282b] border-b border-[#1c1d1f] flex items-center justify-between gap-3 shrink-0">
        <div id="waveform-info-group" class="flex items-center gap-3 min-w-0 flex-1">
          <Button
            id="waveform-play-pause-btn"
            variant="primary"
            size="sm"
            onClick={togglePlay}
            disabled={!props.row}
            icon={playing() ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            title={playing() ? 'Pause (Space)' : 'Play (Space)'}
          >
            <span>{playing() ? 'Pause' : 'Play'}</span>
          </Button>

          <FileAudioIcon size={15} class="text-[#007acc] shrink-0" />
          <span id="waveform-sound-title" class="text-md font-medium text-[#f0f3f6] truncate max-w-[400px]" title={props.row?.path}>
            {props.row?.filename ?? 'No sound selected'}
          </span>

          {region() && (
            <span id="waveform-region-chip" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-[#007acc]/15 border border-[#007acc]/30 text-md font-mono text-[#f0f3f6] shrink-0">
              <span
                id="waveform-region-drag-handle"
                class="cursor-grab active:cursor-grabbing text-[#007acc] hover:text-white transition-colors flex items-center"
                draggable={!rendering() && !!render()}
                onDragStart={onRegionDragStart}
                title={
                  rendering()
                    ? 'Preparing region for drag…'
                    : render()
                      ? 'Drag this region into another app (e.g. Resolve, Audacity)'
                      : 'Region unavailable to drag'
                }
              >
                {rendering() ? <RefreshCwIcon size={12} class="animate-spin" /> : <GripVerticalIcon size={12} />}
              </span>
              <span id="waveform-region-time-bounds">
                {formatRegionSec(region()!.start)} – {formatRegionSec(region()!.end)}
              </span>
              <button
                id="waveform-region-clear-btn"
                type="button"
                class="w-4 h-4 flex items-center justify-center rounded text-[#8b949e] hover:text-white transition-colors cursor-pointer"
                title="Clear region selection"
                onClick={() => {
                  setSelStart(null)
                  setSelEnd(null)
                  bumpRegion()
                }}
              >
                <XIcon size={12} />
              </button>
            </span>
          )}

        </div>

        {/* Volume control slammed to the right on the same line as the play button */}
        <div id="waveform-volume-control" class="flex items-center gap-2.5 px-3 h-8 min-h-[32px] rounded-[3px] bg-[#1e2022] border border-[#1c1d1f] shrink-0" title="Volume — Double-click slider to reset to 100%">
          <IconButton
            id="waveform-mute-btn"
            size="xs"
            onClick={toggleMute}
            tooltip={muted() ? 'Unmute' : 'Mute'}
          >
            {muted() || volume() === 0 ? <VolumeXIcon size={14} /> : <Volume2Icon size={14} />}
          </IconButton>
          <input
            id="waveform-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={muted() ? 0 : volume()}
            onInput={(e) => updateVolume(parseFloat(e.currentTarget.value))}
            onDblClick={() => updateVolume(1)}
            class="w-36 md:w-44 accent-[#007acc] h-2 cursor-pointer"
          />
          <span id="waveform-volume-readout" class="font-mono text-md text-[#8b949e] tabular-nums w-12 text-right select-none">
            {muted() ? '0%' : `${Math.round(volume() * 100)}%`}
          </span>
        </div>
      </div>

      {/* Waveform Canvas Area - Extra breathing room & height */}
      <div id="waveform-canvas-container" class="relative w-full h-32 bg-[#1e2022] cursor-crosshair overflow-hidden px-2 py-1.5" ref={canvasWrap} onMouseDown={onPointerDown}>
        <canvas id="waveform-canvas" ref={canvas} class="w-full h-full block" />
        {loading() && (
          <div id="waveform-loading-overlay" class="absolute inset-0 flex items-center justify-center gap-2 bg-[#1e2022]/80 backdrop-blur-xs text-md text-[#8b949e]">
            <RefreshCwIcon size={16} class="animate-spin text-[#007acc]" />
            <span>Generating waveform…</span>
          </div>
        )}
      </div>

      {/* Playback / Export Sub-Toolbar */}
      <div id="waveform-footer-toolbar" class="h-11 min-h-[44px] px-3.5 bg-[#26282b] border-t border-[#1c1d1f] flex items-center justify-between gap-3 shrink-0">
        <div id="waveform-time-readout" class="font-mono text-md text-[#8b949e] tabular-nums flex items-center gap-1">
          <span class="text-[#007acc] font-medium">{formatTime(progress())}</span>
          <span class="text-[#8b949e]/40 mx-0.5">/</span>
          <span>{formatTime(duration())}</span>
        </div>

        <div id="waveform-footer-actions" class="flex items-center gap-2">
        <Button
          id="waveform-effects-btn"
          variant="default"
          size="sm"
          onClick={() => {
            audioEl?.pause()
            props.onEffectsRequest?.(regionBounds())
          }}
          disabled={!props.row && (!props.selectedCount || props.selectedCount <= 0)}
          icon={<SlidersIcon size={13} />}
          title="Reverse, pitch, speed, fades and loudness, rendered to new files (Ctrl+P)"
        >
          <span>Effects…</span>
        </Button>
        <Button
          id="waveform-slice-btn"
          variant="default"
          size="sm"
          onClick={() => {
            audioEl?.pause()
            props.onSliceRequest?.(regionBounds())
          }}
          disabled={!props.row}
          icon={<ScissorsIcon size={13} />}
          title="Open the Slicer to cut this sound into multiple files (Ctrl+K)"
        >
          <span>Slice…</span>
        </Button>
        <Button
          id="waveform-loop-btn"
          variant="default"
          size="sm"
          onClick={() => {
            audioEl?.pause()
            props.onLoopRequest?.(regionBounds())
          }}
          disabled={!props.row}
          icon={<RepeatIcon size={13} />}
          title="Make a seamless loop from this sound or the selected region (Ctrl+L)"
        >
          <span>Loop…</span>
        </Button>
        <Button
          id="waveform-export-btn"
          variant="primary"
          size="sm"
          onClick={requestExport}
          disabled={!props.row && (!props.selectedCount || props.selectedCount <= 0)}
          icon={<DownloadIcon size={13} />}
        >
          <span>
            {region()
              ? 'Export Region…'
              : (props.selectedCount && props.selectedCount > 1)
                ? `Export ${props.selectedCount} Sounds…`
                : 'Export File…'}
          </span>
        </Button>
        </div>
      </div>

      <audio
        id="waveform-audio-element"
        ref={audioEl}
        preload="auto"
        onPlay={onAudioPlay}
        onPause={onAudioPause}
        onPlaying={scheduleLoopCheck}
        onSeeked={scheduleLoopCheck}
        onTimeUpdate={onAudioTimeUpdate}
        onLoadedMetadata={onAudioLoaded}
        onEnded={onAudioEnded}
        style={{ display: 'none' }}
      />
    </div>
  )
}
