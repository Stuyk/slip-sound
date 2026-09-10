import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js'
import type { ExportFormat, BitDepth, NamingMode, ExportBatchFileResult } from '../../../preload/index'
import {
  XIcon,
  DownloadIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileAudioIcon,
  SlidersIcon,
  TagIcon,
  ChevronDownIcon,
  FolderIcon,
  ArrowRightIcon
} from './icons'

const SAMPLE_RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 96000]
const BIT_DEPTHS: BitDepth[] = [16, 24, 32]

const OGG_BITRATES = [
  '~64 kbps',
  '~80 kbps',
  '~96 kbps',
  '~112 kbps',
  '~128 kbps',
  '~160 kbps',
  '~192 kbps',
  '~224 kbps',
  '~256 kbps',
  '~320 kbps',
  '~500 kbps'
]

export interface ExportFile {
  sourcePath: string
  filename: string
  start?: number
  end?: number
}

// Remembers the last-used format/rate/quality/naming choices across opens —
// baseName is deliberately excluded, since a stale prefix from a previous,
// unrelated export would be more confusing than just defaulting to "sound".
const PREF_KEY = 'slipsound:export-defaults'

interface ExportDefaults {
  format: ExportFormat
  sampleRate: number
  bitDepth: BitDepth
  oggQuality: number
  naming: NamingMode
}

function loadExportDefaults(): ExportDefaults {
  const fallback: ExportDefaults = {
    format: 'wav',
    sampleRate: 44100,
    bitDepth: 16,
    oggQuality: 5,
    naming: 'original'
  }
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

function saveExportDefaults(defaults: ExportDefaults): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(defaults))
  } catch {
    // ignore (private mode / quota) — not worth surfacing to the user
  }
}

export default function ExportModal(props: { open: boolean; files: ExportFile[]; onClose: () => void }) {
  const initialDefaults = loadExportDefaults()
  const [format, setFormat] = createSignal<ExportFormat>(initialDefaults.format)
  const [sampleRate, setSampleRate] = createSignal(initialDefaults.sampleRate)
  const [bitDepth, setBitDepth] = createSignal<BitDepth>(initialDefaults.bitDepth)
  const [oggQuality, setOggQuality] = createSignal(initialDefaults.oggQuality)
  const [naming, setNaming] = createSignal<NamingMode>(initialDefaults.naming)
  const [baseName, setBaseName] = createSignal('sound')
  const [exporting, setExporting] = createSignal(false)
  const [progress, setProgress] = createSignal<{ done: number; total: number } | null>(null)
  const [results, setResults] = createSignal<ExportBatchFileResult[] | null>(null)
  const [destFolder, setDestFolder] = createSignal<string | null>(null)

  createEffect(() => {
    saveExportDefaults({
      format: format(),
      sampleRate: sampleRate(),
      bitDepth: bitDepth(),
      oggQuality: oggQuality(),
      naming: naming()
    })
  })

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && props.open && !exporting()) {
      e.preventDefault()
      close()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown)
  })

  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
  })

  createEffect(() => {
    if (props.open) {
      setExporting(false)
      setProgress(null)
      setResults(null)
      setDestFolder(null)
      const off = window.api.onExportBatchProgress((done, total) => setProgress({ done, total }))
      onCleanup(off)
    }
  })

  const hasRegion = (): boolean => props.files.length === 1 && props.files[0].start !== undefined

  const regionInfo = (): string | null => {
    if (!hasRegion()) return null
    const f = props.files[0]
    if (f.start !== undefined && f.end !== undefined) {
      const dur = Math.max(0, f.end - f.start)
      return `${f.start.toFixed(2)}s – ${f.end.toFixed(2)}s (${dur.toFixed(2)}s)`
    }
    return null
  }

  // Falls back to "sound" only where a name is actually needed (preview/export),
  // never while the user is mid-edit in the input itself.
  const effectiveBaseName = (): string => baseName().trim() || 'sound'

  function previewName(index: number): string {
    const file = props.files[index]
    if (!file) return ''
    const stem = file.filename.replace(/\.[^.]+$/, '')
    const mode = naming()
    if (mode === 'original') return `${stem}.${format()}`
    if (mode === 'numeric') {
      const width = props.files.length > 99 ? String(props.files.length).length : 2
      return `${effectiveBaseName()}_${String(index + 1).padStart(width, '0')}.${format()}`
    }
    return `${effectiveBaseName()}_${toAlpha(index)}.${format()}`
  }

  function toAlpha(index: number): string {
    let n = index
    let result = ''
    do {
      result = String.fromCharCode(97 + (n % 26)) + result
      n = Math.floor(n / 26) - 1
    } while (n >= 0)
    return result
  }

  const summaryText = (): string => {
    if (format() === 'wav') {
      return `WAV · ${(sampleRate() / 1000).toFixed(1)} kHz · ${bitDepth()}-bit PCM`
    }
    return `OGG Vorbis · ${(sampleRate() / 1000).toFixed(1)} kHz · Q${oggQuality()} (${OGG_BITRATES[oggQuality()] || ''})`
  }

  async function runExport(): Promise<void> {
    if (exporting() || props.files.length === 0) return
    setExporting(true)
    setResults(null)
    setProgress(null)
    try {
      const result = await window.api.exportBatch({
        files: props.files.map((f) => ({ sourcePath: f.sourcePath, start: f.start, end: f.end })),
        format: format(),
        sampleRate: sampleRate(),
        bitDepth: format() === 'wav' ? bitDepth() : undefined,
        oggQuality: format() === 'ogg' ? oggQuality() : undefined,
        naming: naming(),
        baseName: effectiveBaseName()
      })
      if (result.canceled) {
        setExporting(false)
        return
      }
      setResults(result.results)
      setDestFolder(result.destFolder ?? null)
    } finally {
      setExporting(false)
    }
  }

  function close(): void {
    if (exporting()) return
    props.onClose()
  }

  const okCount = (): number => results()?.filter((r) => r.ok).length ?? 0
  const failCount = (): number => results()?.filter((r) => !r.ok).length ?? 0

  return (
    <Show when={props.open}>
      <div class="modal-backdrop" onClick={close}>
        <div class="modal-dialog export-modal-dialog" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <header class="modal-header export-modal-header">
            <div class="export-header-left">
              <div class="export-header-icon-box">
                <DownloadIcon size={18} class="text-blue-400" />
              </div>
              <div class="export-header-text">
                <div class="export-header-title-row">
                  <h2 class="modal-title">Export Audio</h2>
                  <span class="export-count-pill">
                    {props.files.length} {props.files.length === 1 ? 'sound' : 'sounds'}
                  </span>
                  <Show when={hasRegion()}>
                    <span class="export-region-pill" title={regionInfo() ?? 'Selected region'}>
                      Region: {regionInfo() ?? 'Selection'}
                    </span>
                  </Show>
                </div>
                <p class="export-header-sub">
                  {props.files.length === 1
                    ? props.files[0].filename
                    : `Configure settings and export ${props.files.length} audio files to disk`}
                </p>
              </div>
            </div>
            <button class="modal-close-btn" onClick={close} disabled={exporting()} title="Close (Esc)">
              <XIcon size={16} />
            </button>
          </header>

          <Show
            when={!results()}
            fallback={
              <div class="export-results-view">
                <div class="export-results-hero">
                  <div
                    class="export-hero-icon-box"
                    classList={{
                      'all-ok': failCount() === 0,
                      'has-fail': failCount() > 0
                    }}
                  >
                    {failCount() === 0 ? (
                      <CheckCircleIcon size={24} class="text-emerald-400" />
                    ) : (
                      <AlertCircleIcon size={24} class="text-amber-400" />
                    )}
                  </div>
                  <div class="export-hero-text">
                    <h3 class="export-hero-title">
                      {failCount() === 0 ? 'Export Completed Successfully' : 'Export Finished with Warnings'}
                    </h3>
                    <div class="export-hero-badges">
                      <Show when={okCount() > 0}>
                        <span class="export-summary-ok">
                          <CheckCircleIcon size={13} /> {okCount()} exported
                        </span>
                      </Show>
                      <Show when={failCount() > 0}>
                        <span class="export-summary-fail">
                          <AlertCircleIcon size={13} /> {failCount()} failed
                        </span>
                      </Show>
                    </div>
                  </div>
                </div>

                <Show when={destFolder()}>
                  <div class="export-dest-card">
                    <div class="export-dest-header">
                      <FolderIcon size={14} class="text-blue-400" />
                      <span>Destination Folder</span>
                    </div>
                    <div class="export-dest-path" title={destFolder()!}>
                      {destFolder()}
                    </div>
                  </div>
                </Show>

                <div class="export-results-list-box">
                  <div class="export-results-list-header">Export Summary ({results()!.length} files)</div>
                  <div class="export-results-list">
                    <For each={results()}>
                      {(r) => (
                        <div class="export-result-row" classList={{ failed: !r.ok }}>
                          {r.ok ? (
                            <CheckCircleIcon size={14} class="text-emerald-400 flex-shrink-0" />
                          ) : (
                            <AlertCircleIcon size={14} class="text-red-400 flex-shrink-0" />
                          )}
                          <span class="export-result-name">
                            {r.destPath
                              ? r.destPath.split(/[/\\]/).pop()
                              : r.sourcePath.split(/[/\\]/).pop()}
                          </span>
                          {!r.ok && <span class="export-result-error" title={r.error}>{r.error}</span>}
                        </div>
                      )}
                    </For>
                  </div>
                </div>

                <div class="modal-footer export-modal-footer">
                  <span />
                  <button class="btn-flat btn-primary" onClick={close}>
                    Done
                  </button>
                </div>
              </div>
            }
          >
            <div class="export-modal-body">
              {/* Section 1: Audio Format & Encoding */}
              <div class="export-section-card">
                <div class="export-section-header">
                  <SlidersIcon size={14} class="text-blue-400" />
                  <span class="export-section-title">Format & Encoding</span>
                </div>

                <div class="export-form-grid">
                  {/* Format */}
                  <div class="export-form-row">
                    <label class="export-form-label">Format</label>
                    <div class="export-form-control">
                      <div class="export-segmented-control">
                        <button
                          type="button"
                          class="export-segmented-btn"
                          classList={{ active: format() === 'wav' }}
                          onClick={() => setFormat('wav')}
                        >
                          WAV (Lossless PCM)
                        </button>
                        <button
                          type="button"
                          class="export-segmented-btn"
                          classList={{ active: format() === 'ogg' }}
                          onClick={() => setFormat('ogg')}
                        >
                          OGG (Vorbis VBR)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sample Rate */}
                  <div class="export-form-row">
                    <label class="export-form-label">Sample Rate</label>
                    <div class="export-form-control">
                      <div class="export-select-wrap">
                        <select
                          class="export-select-input"
                          value={sampleRate()}
                          onChange={(e) => setSampleRate(parseInt(e.currentTarget.value, 10))}
                        >
                          {SAMPLE_RATES.map((rate) => (
                            <option value={rate}>
                              {rate >= 1000 ? `${rate / 1000} kHz` : `${rate} Hz`} ({rate} Hz)
                            </option>
                          ))}
                        </select>
                        <ChevronDownIcon size={14} class="export-select-arrow" />
                      </div>
                    </div>
                  </div>

                  {/* Bit Depth (WAV) */}
                  <Show when={format() === 'wav'}>
                    <div class="export-form-row">
                      <label class="export-form-label">Bit Depth</label>
                      <div class="export-form-control">
                        <div class="export-segmented-control">
                          <For each={BIT_DEPTHS}>
                            {(bd) => (
                              <button
                                type="button"
                                class="export-segmented-btn"
                                classList={{ active: bitDepth() === bd }}
                                onClick={() => setBitDepth(bd)}
                              >
                                {bd}-bit
                              </button>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                  </Show>

                  {/* VBR Quality (OGG) */}
                  <Show when={format() === 'ogg'}>
                    <div class="export-form-row">
                      <label class="export-form-label">Quality</label>
                      <div class="export-form-control">
                        <div class="export-slider-container">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="1"
                            value={oggQuality()}
                            onInput={(e) => setOggQuality(parseInt(e.currentTarget.value, 10))}
                            class="export-quality-slider"
                          />
                          <div class="export-slider-readout">
                            <span class="export-slider-val">Q{oggQuality()}</span>
                            <span class="export-slider-bitrate">{OGG_BITRATES[oggQuality()]}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Section 2: File Naming Pattern */}
              <div class="export-section-card">
                <div class="export-section-header">
                  <TagIcon size={14} class="text-indigo-400" />
                  <span class="export-section-title">File Naming</span>
                </div>

                <div class="export-form-grid">
                  {/* Naming Mode */}
                  <div class="export-form-row">
                    <label class="export-form-label">Naming Mode</label>
                    <div class="export-form-control">
                      <div class="export-segmented-control">
                        <button
                          type="button"
                          class="export-segmented-btn"
                          classList={{ active: naming() === 'original' }}
                          onClick={() => setNaming('original')}
                        >
                          Keep Original
                        </button>
                        <button
                          type="button"
                          class="export-segmented-btn"
                          classList={{ active: naming() === 'numeric' }}
                          onClick={() => setNaming('numeric')}
                        >
                          Numeric 01–99
                        </button>
                        <button
                          type="button"
                          class="export-segmented-btn"
                          classList={{ active: naming() === 'alpha' }}
                          onClick={() => setNaming('alpha')}
                        >
                          Alphabetic a–z
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Base Name Prefix (only when renamed) */}
                  <Show when={naming() !== 'original'}>
                    <div class="export-form-row">
                      <label class="export-form-label">Base Name</label>
                      <div class="export-form-control">
                        <div class="export-input-wrap">
                          <input
                            type="text"
                            class="export-text-input"
                            value={baseName()}
                            onInput={(e) => setBaseName(e.currentTarget.value)}
                            placeholder="sound"
                          />
                          <span class="export-input-hint">Filename prefix applied before number/letter suffix</span>
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Section 3: Output Preview */}
              <div class="export-section-card export-preview-card">
                <div class="export-section-header">
                  <div class="export-section-header-left">
                    <FileAudioIcon size={14} class="text-emerald-400" />
                    <span class="export-section-title">Output Preview</span>
                  </div>
                  <span class="export-preview-count-meta">
                    {props.files.length} {props.files.length === 1 ? 'target file' : 'target files'}
                  </span>
                </div>

                <div class="export-preview-list-container">
                  <For each={props.files.slice(0, 5)}>
                    {(file, i) => (
                      <div class="export-preview-item">
                        <span class="export-preview-seq">#{String(i() + 1).padStart(2, '0')}</span>
                        <FileAudioIcon size={13} class="export-preview-icon" />
                        <span class="export-preview-target">{previewName(i())}</span>
                        <Show when={naming() !== 'original'}>
                          <ArrowRightIcon size={11} class="export-preview-arrow" />
                          <span class="export-preview-source" title={file.filename}>
                            {file.filename}
                          </span>
                        </Show>
                      </div>
                    )}
                  </For>
                  <Show when={props.files.length > 5}>
                    <div class="export-preview-overflow">
                      + {props.files.length - 5} additional files will follow this pattern
                    </div>
                  </Show>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <footer class="modal-footer export-modal-footer">
              <div class="export-footer-info">
                <Show
                  when={exporting() && progress()}
                  fallback={<span class="export-summary-label">{summaryText()}</span>}
                >
                  <div class="export-progress-container">
                    <div class="export-progress-track">
                      <div
                        class="export-progress-fill"
                        style={{
                          width: `${Math.round((progress()!.done / Math.max(1, progress()!.total)) * 100)}%`
                        }}
                      />
                    </div>
                    <span class="export-progress-text tabular">
                      Exporting {progress()!.done} of {progress()!.total}…
                    </span>
                  </div>
                </Show>
              </div>

              <div class="export-footer-actions">
                <button class="btn-flat btn-ghost" onClick={close} disabled={exporting()}>
                  Cancel
                </button>
                <button
                  class="btn-flat btn-primary export-submit-btn"
                  onClick={runExport}
                  disabled={exporting() || props.files.length === 0}
                >
                  {exporting() ? (
                    <RefreshCwIcon size={14} class="animate-spin" />
                  ) : (
                    <DownloadIcon size={14} />
                  )}
                  <span>
                    {exporting()
                      ? 'Exporting…'
                      : `Export ${props.files.length} ${props.files.length === 1 ? 'Sound' : 'Sounds'}`}
                  </span>
                </button>
              </div>
            </footer>
          </Show>
        </div>
      </div>
    </Show>
  )
}
