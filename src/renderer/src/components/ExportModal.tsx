import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { ExportFormat, BitDepth, NamingMode, ExportBatchFileResult } from '../../../preload/index';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { SegmentedControl } from './ui/SegmentedControl';
import { Select } from './ui/Select';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Sliders,
  Tag,
  Folder,
  ArrowRight,
  RefreshCw,
} from 'lucide-solid';

const SAMPLE_RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 96000];
const BIT_DEPTHS: BitDepth[] = [16, 24, 32];

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
  '~500 kbps',
];

export interface ExportFile {
  sourcePath: string;
  filename: string;
  start?: number;
  end?: number;
}

const PREF_KEY = 'slipsound:export-defaults';

interface ExportDefaults {
  format: ExportFormat;
  sampleRate: number;
  bitDepth: BitDepth;
  oggQuality: number;
  naming: NamingMode;
}

function loadExportDefaults(): ExportDefaults {
  const fallback: ExportDefaults = {
    format: 'wav',
    sampleRate: 44100,
    bitDepth: 16,
    oggQuality: 5,
    naming: 'original',
  };
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function saveExportDefaults(defaults: ExportDefaults): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(defaults));
  } catch {
    // ignore
  }
}

export default function ExportModal(props: { open: boolean; files: ExportFile[]; onClose: () => void }) {
  const initialDefaults = loadExportDefaults();
  const [format, setFormat] = createSignal<ExportFormat>(initialDefaults.format);
  const [sampleRate, setSampleRate] = createSignal(initialDefaults.sampleRate);
  const [bitDepth, setBitDepth] = createSignal<BitDepth>(initialDefaults.bitDepth);
  const [oggQuality, setOggQuality] = createSignal(initialDefaults.oggQuality);
  const [naming, setNaming] = createSignal<NamingMode>(initialDefaults.naming);
  const [baseName, setBaseName] = createSignal('sound');
  const [exporting, setExporting] = createSignal(false);
  const [progress, setProgress] = createSignal<{ done: number; total: number } | null>(null);
  const [results, setResults] = createSignal<ExportBatchFileResult[] | null>(null);
  const [destFolder, setDestFolder] = createSignal<string | null>(null);

  createEffect(() => {
    saveExportDefaults({
      format: format(),
      sampleRate: sampleRate(),
      bitDepth: bitDepth(),
      oggQuality: oggQuality(),
      naming: naming(),
    });
  });

  createEffect(() => {
    if (props.open) {
      setExporting(false);
      setProgress(null);
      setResults(null);
      setDestFolder(null);
      const off = window.api.onExportBatchProgress((done, total) => setProgress({ done, total }));
      onCleanup(off);
    }
  });

  const hasRegion = (): boolean => props.files.length === 1 && props.files[0].start !== undefined;

  const regionInfo = (): string | null => {
    if (!hasRegion()) return null;
    const f = props.files[0];
    if (f.start !== undefined && f.end !== undefined) {
      const dur = Math.max(0, f.end - f.start);
      return `${f.start.toFixed(2)}s – ${f.end.toFixed(2)}s (${dur.toFixed(2)}s)`;
    }
    return null;
  };

  const effectiveBaseName = (): string => baseName().trim() || 'sound';

  function previewName(index: number): string {
    const file = props.files[index];
    if (!file) return '';
    const stem = file.filename.replace(/\.[^.]+$/, '');
    const mode = naming();
    if (mode === 'original') return `${stem}.${format()}`;
    if (mode === 'numeric') {
      const width = props.files.length > 99 ? String(props.files.length).length : 2;
      return `${effectiveBaseName()}_${String(index + 1).padStart(width, '0')}.${format()}`;
    }
    return `${effectiveBaseName()}_${toAlpha(index)}.${format()}`;
  }

  function toAlpha(index: number): string {
    let n = index;
    let result = '';
    do {
      result = String.fromCharCode(97 + (n % 26)) + result;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return result;
  }

  const summaryText = (): string => {
    if (format() === 'wav') {
      return `WAV · ${(sampleRate() / 1000).toFixed(1)} kHz · ${bitDepth()}-bit PCM`;
    }
    return `OGG Vorbis · ${(sampleRate() / 1000).toFixed(1)} kHz · Q${oggQuality()} (${OGG_BITRATES[oggQuality()] || ''})`;
  };

  async function runExport(): Promise<void> {
    if (exporting() || props.files.length === 0) return;
    setExporting(true);
    setResults(null);
    setProgress(null);
    try {
      const result = await window.api.exportBatch({
        files: props.files.map((f) => ({ sourcePath: f.sourcePath, start: f.start, end: f.end })),
        format: format(),
        sampleRate: sampleRate(),
        bitDepth: format() === 'wav' ? bitDepth() : undefined,
        oggQuality: format() === 'ogg' ? oggQuality() : undefined,
        naming: naming(),
        baseName: effectiveBaseName(),
      });
      if (result.canceled) {
        setExporting(false);
        return;
      }
      setResults(result.results);
      setDestFolder(result.destFolder ?? null);
    } finally {
      setExporting(false);
    }
  }

  function close(): void {
    if (exporting()) return;
    props.onClose();
  }

  const okCount = (): number => results()?.filter((r) => r.ok).length ?? 0;
  const failCount = (): number => results()?.filter((r) => !r.ok).length ?? 0;

  return (
    <Modal
      id="export-modal"
      isOpen={props.open}
      onClose={close}
      title={
        <div class="flex items-center gap-2">
          <span>Export Audio</span>
          <Badge variant="accent">{props.files.length} {props.files.length === 1 ? 'sound' : 'sounds'}</Badge>
          <Show when={hasRegion()}>
            <Badge variant="warning">Region: {regionInfo()}</Badge>
          </Show>
        </div>
      }
      icon={<Download size={15} />}
      width="640px"
      footer={
        <Show
          when={!results()}
          fallback={
            <div id="export-modal-footer-done" class="w-full flex justify-end">
              <Button id="export-modal-btn-done" variant="primary" size="sm" onClick={close}>
                Done
              </Button>
            </div>
          }
        >
          <div id="export-modal-footer-actions" class="w-full flex items-center justify-between">
            <span id="export-modal-summary" class="text-md font-mono text-[var(--text-muted)]">
              {summaryText()}
            </span>
            <div class="flex items-center gap-2">
              <Button id="export-modal-btn-cancel" variant="ghost" size="sm" onClick={close} disabled={exporting()}>
                Cancel
              </Button>
              <Button
                id="export-modal-btn-start"
                variant="primary"
                size="sm"
                onClick={runExport}
                disabled={exporting() || props.files.length === 0}
                icon={exporting() ? <RefreshCw size={12} class="animate-spin" /> : <Download size={12} />}
              >
                {exporting()
                  ? 'Exporting…'
                  : `Export ${props.files.length} ${props.files.length === 1 ? 'Sound' : 'Sounds'}`}
              </Button>
            </div>
          </div>
        </Show>
      }
    >
      <Show
        when={!results()}
        fallback={
          <div class="flex flex-col gap-3 py-2 text-md">
            <div class="flex items-center gap-3 p-3 bg-black/20 border border-[var(--border-color)] rounded-[3px]">
              <div class="shrink-0">
                {failCount() === 0 ? (
                  <CheckCircle2 size={24} class="text-emerald-400" />
                ) : (
                  <AlertCircle size={24} class="text-amber-400" />
                )}
              </div>
              <div>
                <div class="font-bold text-md text-[var(--text-main)]">
                  {failCount() === 0 ? 'Export Completed Successfully' : 'Export Finished with Warnings'}
                </div>
                <div class="flex gap-2 mt-1">
                  <Show when={okCount() > 0}>
                    <Badge variant="success">{okCount()} exported</Badge>
                  </Show>
                  <Show when={failCount() > 0}>
                    <Badge variant="error">{failCount()} failed</Badge>
                  </Show>
                </div>
              </div>
            </div>

            <Show when={destFolder()}>
              <div class="flex items-center gap-2 p-2 bg-black/30 border border-[var(--border-color)] rounded-[2px] font-mono text-md">
                <Folder size={13} class="text-[var(--accent-color)] shrink-0" />
                <span class="truncate text-[var(--text-muted)]">{destFolder()}</span>
              </div>
            </Show>

            <div class="flex flex-col gap-1 max-h-48 overflow-y-auto dcc-scroll bg-black/30 border border-[var(--border-color)] rounded-[2px] p-2">
              <For each={results()}>
                {(r) => (
                  <div class="flex items-center justify-between text-md font-mono py-0.5 border-b border-white/5">
                    <div class="flex items-center gap-1.5 truncate">
                      {r.ok ? (
                        <CheckCircle2 size={12} class="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle size={12} class="text-red-400 shrink-0" />
                      )}
                      <span class="truncate">{r.destPath ? r.destPath.split(/[/\\]/).pop() : r.sourcePath.split(/[/\\]/).pop()}</span>
                    </div>
                    {!r.ok && <span class="text-red-400 text-md shrink-0">{r.error}</span>}
                  </div>
                )}
              </For>
            </div>
          </div>
        }
      >
        <div class="flex flex-col gap-4 text-md">
          {/* Section 1: Format & Encoding */}
          <div class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-3">
            <div class="flex items-center gap-1.5 font-bold text-md text-[var(--text-main)]">
              <Sliders size={13} class="text-[var(--accent-color)]" />
              <span>Format & Encoding</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-md font-mono uppercase text-[var(--text-muted)]">Format</label>
                <SegmentedControl
                  id="export-format-control"
                  value={format()}
                  onChange={(val) => setFormat(val as ExportFormat)}
                  items={[
                    { id: 'wav', label: 'WAV (Lossless PCM)' },
                    { id: 'ogg', label: 'OGG (Vorbis VBR)' },
                  ]}
                />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-md font-mono uppercase text-[var(--text-muted)]">Sample Rate</label>
                <Select
                  id="export-sample-rate-select"
                  value={String(sampleRate())}
                  onChange={(val) => setSampleRate(parseInt(val, 10))}
                  options={SAMPLE_RATES.map((rate) => ({
                    value: String(rate),
                    label: `${rate >= 1000 ? `${rate / 1000} kHz` : `${rate} Hz`} (${rate} Hz)`,
                  }))}
                />
              </div>

              <Show when={format() === 'wav'}>
                <div class="flex flex-col gap-1">
                  <label class="text-md font-mono uppercase text-[var(--text-muted)]">Bit Depth</label>
                  <SegmentedControl
                    id="export-bit-depth-control"
                    value={String(bitDepth())}
                    onChange={(val) => setBitDepth(parseInt(val, 10) as BitDepth)}
                    items={BIT_DEPTHS.map((bd) => ({ id: String(bd), label: `${bd}-bit` }))}
                  />
                </div>
              </Show>

              <Show when={format() === 'ogg'}>
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between items-center text-md">
                    <span class="font-mono uppercase text-[var(--text-muted)]">Quality</span>
                    <span class="font-mono text-[var(--accent-color)]">Q{oggQuality()} ({OGG_BITRATES[oggQuality()]})</span>
                  </div>
                  <input
                    id="export-ogg-quality-slider"
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={oggQuality()}
                    onInput={(e) => setOggQuality(parseInt(e.currentTarget.value, 10))}
                    class="w-full accent-[var(--accent-color)] h-2 cursor-pointer"
                  />
                </div>
              </Show>
            </div>
          </div>

          {/* Section 2: File Naming Pattern */}
          <div class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-3">
            <div class="flex items-center gap-1.5 font-bold text-md text-[var(--text-main)]">
              <Tag size={13} class="text-[var(--accent-color)]" />
              <span>File Naming</span>
            </div>

            <div class="flex flex-col gap-2">
              <SegmentedControl
                id="export-naming-control"
                value={naming()}
                onChange={(val) => setNaming(val as NamingMode)}
                items={[
                  { id: 'original', label: 'Keep Original' },
                  { id: 'numeric', label: 'Numeric (01–99)' },
                  { id: 'alpha', label: 'Alphabetic (a–z)' },
                ]}
              />

              <Show when={naming() !== 'original'}>
                <div class="flex flex-col gap-1 mt-1">
                  <label class="text-md font-mono uppercase text-[var(--text-muted)]">
                    Base Name Prefix
                  </label>
                  <div class="flex items-center h-7 min-h-[28px] bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[2px] px-2">
                    <input
                      id="export-base-name-input"
                      type="text"
                      class="w-full bg-transparent text-md text-[var(--text-main)] focus:outline-none"
                      value={baseName()}
                      onInput={(e) => setBaseName(e.currentTarget.value)}
                      placeholder="sound"
                    />
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Section 3: Output Preview */}
          <div class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between text-md text-[var(--text-main)] font-bold">
              <div class="flex items-center gap-1.5">
                <FileAudio size={13} class="text-emerald-400" />
                <span>Output Preview</span>
              </div>
              <span class="text-md font-mono text-[var(--text-muted)] font-normal">
                {props.files.length} {props.files.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            <div class="flex flex-col gap-1 bg-black/30 border border-[var(--border-color)] rounded-[2px] p-2 max-h-32 overflow-y-auto dcc-scroll font-mono text-md">
              <For each={props.files.slice(0, 5)}>
                {(file, i) => (
                  <div class="flex items-center gap-2 py-0.5">
                    <span class="text-[var(--text-muted)] w-5 text-right shrink-0">#{String(i() + 1).padStart(2, '0')}</span>
                    <span class="text-[var(--accent-color)] font-medium truncate">{previewName(i())}</span>
                    <Show when={naming() !== 'original'}>
                      <ArrowRight size={10} class="text-[var(--text-muted)] shrink-0" />
                      <span class="text-[var(--text-muted)] truncate opacity-70">{file.filename}</span>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={props.files.length > 5}>
                <div class="text-md text-[var(--text-muted)] italic pt-1 border-t border-white/5">
                  + {props.files.length - 5} additional files will follow this pattern
                </div>
              </Show>
            </div>
          </div>

          {/* Export Progress Bar */}
          <Show when={exporting() && progress()}>
            <div class="p-2 bg-black/40 border border-[var(--border-color)] rounded-[3px]">
              <ProgressBar
                value={Math.round((progress()!.done / Math.max(1, progress()!.total)) * 100)}
                label="Exporting batch..."
                statusText={`${progress()!.done} of ${progress()!.total}`}
              />
            </div>
          </Show>
        </div>
      </Show>
    </Modal>
  );
}
