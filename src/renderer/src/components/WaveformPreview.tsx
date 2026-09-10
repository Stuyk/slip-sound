import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { SoundRow } from '../../../preload/index'
import {
  PlayIcon,
  PauseIcon,
  DownloadIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
  FileAudioIcon,
  RefreshCwIcon,
  GripVerticalIcon
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

export default function WaveformPreview(props: {
  row: SoundRow | null
  onApi?: (api: WaveformApi) => void
  onExportRequest?: (region: { start: number; end: number } | null) => void
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

  // Region file dragged out to another app (e.g. Audacity). Re-rendered whenever the region changes.
  const [dragFilePath, setDragFilePath] = createSignal<string | null>(null)
  const [dragFileBusy, setDragFileBusy] = createSignal(false)
  let dragExportToken = 0

  let audioCtx: AudioContext | undefined
  let currentToken = 0
  let rafId: number | undefined
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
    const hasSel = start !== null && end !== null && dur > 0 && Math.abs(end - start) >= 0.02

    // Draw selection background
    if (hasSel) {
      const x1 = (Math.min(start!, end!) / dur) * width
      const x2 = (Math.max(start!, end!) / dur) * width
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)'
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
          ctx.fillStyle = '#3b82f6' // Crisp flat blue playhead
        } else if (inSel) {
          ctx.fillStyle = '#f59e0b' // Gold selection region
        } else {
          ctx.fillStyle = '#3d3d48' // Flat dark neutral
        }

        const w = Math.max(1, barWidth - 1)
        ctx.fillRect(x, mid - h / 2, w, h)
      }
    }

    // Draw selection borders
    if (hasSel) {
      const x1 = (Math.min(start!, end!) / dur) * width
      const x2 = (Math.max(start!, end!) / dur) * width
      ctx.strokeStyle = '#f59e0b'
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
      setDragFilePath(null)
      cancelAnimationFrame(rafId!)
      if (audioEl) {
        audioEl.pause()
        audioEl.src = ''
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
    setDragFilePath(null)
    cancelAnimationFrame(rafId!)

    if (audioEl) {
      audioEl.pause()
      audioEl.src = window.api.audioUrl(row.path)
      audioEl.currentTime = 0
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
    if (end - start < 0.03) return null
    return { start, end }
  }

  async function prepareRegionDragFile(region: { start: number; end: number }): Promise<void> {
    const row = props.row
    if (!row || region.end - region.start < 0.01) {
      setDragFilePath(null)
      return
    }
    const token = ++dragExportToken
    setDragFileBusy(true)
    setDragFilePath(null)
    try {
      const path = await window.api.exportRegionToTemp({
        sourcePath: row.path,
        sampleRate: row.sample_rate ?? 44100,
        start: region.start,
        end: region.end
      })
      if (token === dragExportToken) setDragFilePath(path)
    } catch {
      if (token === dragExportToken) setDragFilePath(null)
    } finally {
      if (token === dragExportToken) setDragFileBusy(false)
    }
  }

  function onRegionDragStart(e: DragEvent): void {
    e.preventDefault()
    const path = dragFilePath()
    if (path) window.api.startDrag([path])
  }

  function togglePlay(): void {
    if (!audioEl || !props.row) return
    if (audioEl.paused) {
      const region = regionBounds()
      if (region && (audioEl.currentTime < region.start || audioEl.currentTime >= region.end)) {
        audioEl.currentTime = region.start
      }
      audioEl.play().catch(() => {})
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
    const isDrag = dragMoved && Math.abs(endTime - dragStartTime) >= 0.03

    if (!isDrag) {
      // plain click: clear any region and seek/play from that point
      setSelStart(null)
      setSelEnd(null)
      setDragFilePath(null)
      audioEl.currentTime = endTime
      audioEl.play().catch(() => {})
    } else {
      const s = Math.min(dragStartTime, endTime)
      const eTime = Math.max(dragStartTime, endTime)
      setSelStart(s)
      setSelEnd(eTime)
      audioEl.currentTime = s
      audioEl.play().catch(() => {})
      prepareRegionDragFile({ start: s, end: eTime })
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
      return true
    }
    return false
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
    if (audioEl) setProgress(audioEl.currentTime)
  }

  function onAudioEnded(): void {
    setPlaying(false)
    cancelAnimationFrame(rafId!)
    const region = regionBounds()
    setProgress(region ? region.start : 0)
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
    if (!props.row) return
    props.onExportRequest?.(regionBounds())
  }

  let resizeObserver: ResizeObserver | undefined

  onMount(() => {
    props.onApi?.({
      togglePlay,
      play: () => {
        if (audioEl) {
          audioEl.play().catch(() => {})
          cancelAnimationFrame(rafId!)
          rafId = requestAnimationFrame(playheadTick)
        }
      },
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
    clearTimeout(loadDebounceTimer)
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
    <div class="waveform-dock">
      {/* Top Waveform Header Bar */}
      <div class="waveform-toolbar">
        <div class="waveform-left-controls">
          <button
            class="play-toggle-btn"
            onClick={togglePlay}
            disabled={!props.row}
            title={playing() ? 'Pause (Space)' : 'Play (Space)'}
          >
            {playing() ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>

          <FileAudioIcon size={16} class="text-zinc-500" />
          <span class="waveform-title" title={props.row?.path}>
            {props.row?.filename ?? 'No sound selected'}
          </span>

          {region() && (
            <span class="region-chip">
              <span
                class="region-drag-handle"
                draggable={!dragFileBusy() && !!dragFilePath()}
                onDragStart={onRegionDragStart}
                title={
                  dragFileBusy()
                    ? 'Preparing region for drag…'
                    : dragFilePath()
                      ? 'Drag this region into another app (e.g. Audacity)'
                      : 'Region unavailable to drag'
                }
              >
                {dragFileBusy() ? <RefreshCwIcon size={12} class="animate-spin" /> : <GripVerticalIcon size={12} />}
              </span>
              <span>
                {formatRegionSec(region()!.start)} – {formatRegionSec(region()!.end)}
              </span>
              <button
                class="region-clear-btn"
                title="Clear region selection"
                onClick={() => {
                  setSelStart(null)
                  setSelEnd(null)
                  setDragFilePath(null)
                }}
              >
                <XIcon size={13} />
              </button>
            </span>
          )}
        </div>

      </div>

      {/* Waveform Canvas Area */}
      <div class="waveform-canvas-wrap" ref={canvasWrap} onMouseDown={onPointerDown}>
        <canvas ref={canvas} class="waveform-canvas-element" />
        {loading() && (
          <div class="waveform-loading-overlay">
            <RefreshCwIcon size={16} class="animate-spin text-blue-400" />
            <span>Generating waveform…</span>
          </div>
        )}
      </div>

      {/* Playback / Export Sub-Toolbar */}
      <div class="export-dock">
        <div class="timecode-display tabular">
          <span class="timecode-current">{formatTime(progress())}</span>
          <span style={{ margin: '0 4px', color: 'var(--text-faint)' }}>/</span>
          <span>{formatTime(duration())}</span>
        </div>

        <div class="volume-control" title="Volume">
          <button
            class="btn-flat btn-ghost btn-icon-only"
            onClick={toggleMute}
            style={{ width: '28px', height: '28px' }}
          >
            {muted() || volume() === 0 ? <VolumeXIcon size={16} /> : <Volume2Icon size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted() ? 0 : volume()}
            onInput={(e) => updateVolume(parseFloat(e.currentTarget.value))}
            class="volume-slider"
          />
        </div>

        <button
          class="btn-flat btn-primary export-dock-btn"
          onClick={requestExport}
          disabled={!props.row}
        >
          <DownloadIcon size={14} />
          <span>{region() ? 'Export Region…' : 'Export File…'}</span>
        </button>
      </div>

      <audio
        ref={audioEl}
        preload="auto"
        onPlay={onAudioPlay}
        onPause={onAudioPause}
        onTimeUpdate={onAudioTimeUpdate}
        onLoadedMetadata={() => {
          if (audioEl && isFinite(audioEl.duration) && audioEl.duration > 0) {
            setDuration(audioEl.duration)
          }
        }}
        onEnded={onAudioEnded}
        style={{ display: 'none' }}
      />
    </div>
  )
}
