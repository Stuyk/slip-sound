import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { ExportFormat, BitDepth, NamingMode, ExportBatchFileResult } from '../../../preload/index';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { SegmentedControl } from './ui/SegmentedControl';
import { Select } from './ui/Select';
import { TextInput } from './ui/TextInput';
import { Slider } from './ui/Slider';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Folder,
  RefreshCw,
  Sparkles,
  Scissors,
} from 'lucide-solid';

const SAMPLE_RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 96000];
const BIT_DEPTHS: BitDepth[] = [16, 24, 32];

const OGG_BITRATES = [
  '~64 kbps (Voice)',
  '~80 kbps',
  '~96 kbps',
  '~112 kbps',
  '~128 kbps (Standard)',
  '~160 kbps (High)',
  '~192 kbps',
  '~224 kbps',
  '~256 kbps (Very High)',
  '~320 kbps (Near Lossless)',
  '~500 kbps (Maximum)',
];

export interface ExportFile {
  sourcePath: string;
  filename: string;
  start?: number;
  end?: number;
  // Output stem override (slices); used by "Keep Original" naming.
  name?: string;
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
  const [activePreset, setActivePreset] = createSignal<'cd' | 'game' | 'web' | null>(null);

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
  const isSliceSet = (): boolean => props.files.length > 1 && props.files.some((f) => f.start !== undefined);

  const regionInfo = (): string | null => {
    if (!hasRegion()) return null;
    const f = props.files[0];
    if (f.start !== undefined && f.end !== undefined) {
      const dur = Math.max(0, f.end - f.start);
      return `${f.start.toFixed(2)}s – ${f.end.toFixed(2)}s (${dur.toFixed(2)}s duration)`;
    }
    return null;
  };

  const effectiveBaseName = (): string => baseName().trim() || 'sound';

  function previewName(index: number): string {
    const file = props.files[index];
    if (!file) return '';
    const stem = file.name ?? file.filename.replace(/\.[^.]+$/, '');
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

  function applyPreset(preset: 'cd' | 'game' | 'web') {
    setActivePreset(preset);
    if (preset === 'cd') {
      setFormat('wav');
      setSampleRate(44100);
      setBitDepth(16);
    } else if (preset === 'game') {
      setFormat('wav');
      setSampleRate(48000);
      setBitDepth(24);
    } else if (preset === 'web') {
      setFormat('ogg');
      setSampleRate(44100);
      setOggQuality(5);
    }
  }

  const summaryText = (): string => {
    if (format() === 'wav') {
      return `WAV · ${(sampleRate() / 1000).toFixed(1)} kHz · ${bitDepth()}-bit`;
    }
    return `OGG · ${(sampleRate() / 1000).toFixed(1)} kHz · Q${oggQuality()}`;
  };

  async function runExport(): Promise<void> {
    if (exporting() || props.files.length === 0) return;
    setExporting(true);
    setResults(null);
    setProgress(null);
    try {
      const result = await window.api.exportBatch({
        files: props.files.map((f) => ({ sourcePath: f.sourcePath, start: f.start, end: f.end, name: f.name })),
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
        <div class="flex items-center gap-2.5">
          <span>Export Audio</span>
          <Badge variant="accent">
            {props.files.length} {props.files.length === 1 ? 'sound' : 'sounds'}
          </Badge>
          <Show when={hasRegion()}>
            <Badge variant="warning" class="flex items-center gap-1">
              <Scissors size={12} />
              <span>Trimmed Region</span>
            </Badge>
          </Show>
          <Show when={isSliceSet()}>
            <Badge variant="warning" class="flex items-center gap-1">
              <Scissors size={12} />
              <span>Slices</span>
            </Badge>
          </Show>
        </div>
      }
      icon={<Download size={16} />}
      width="580px"
      footer={
        <Show
          when={!results()}
          fallback={
            <div id="export-modal-footer-done" class="w-full flex items-center justify-between">
              <span class="text-md text-[var(--text-muted)] font-mono">
                {okCount()} exported, {failCount()} failed
              </span>
              <Button id="export-modal-btn-done" variant="primary" size="sm" onClick={close}>
                Done
              </Button>
            </div>
          }
        >
          <div id="export-modal-footer-actions" class="w-full flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-md text-[var(--text-muted)] font-mono">Preset:</span>
              <span id="export-modal-summary" class="text-md font-mono text-[var(--accent-color)] font-semibold">
                {summaryText()}
              </span>
            </div>
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
                icon={exporting() ? <RefreshCw size={13} class="animate-spin" /> : <Download size={13} />}
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
          /* Export Results Screen */
          <div class="flex flex-col gap-4 py-1 text-md">
            <div class="flex items-center gap-3.5 p-3.5 bg-black/20 border border-[var(--border-color)] rounded-[3px]">
              <div class="shrink-0">
                {failCount() === 0 ? (
                  <CheckCircle2 size={24} class="text-emerald-400" />
                ) : (
                  <AlertCircle size={24} class="text-amber-400" />
                )}
              </div>
              <div class="flex flex-col gap-1">
                <div class="font-bold text-md text-[var(--text-main)]">
                  {failCount() === 0 ? 'Export Completed Successfully' : 'Export Finished with Warnings'}
                </div>
                <div class="flex gap-2">
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
              <div class="flex flex-col gap-1.5 p-3 bg-black/20 border border-[var(--border-color)] rounded-[3px]">
                <span class="text-md font-mono text-[var(--text-muted)]">Destination Folder</span>
                <div class="flex items-center gap-2 font-mono text-md text-[var(--text-main)] truncate">
                  <Folder size={15} class="text-[var(--accent-color)] shrink-0" />
                  <span class="truncate">{destFolder()}</span>
                </div>
              </div>
            </Show>

            <div class="flex flex-col gap-1 max-h-56 overflow-y-auto dcc-scroll bg-black/20 border border-[var(--border-color)] rounded-[3px] p-2.5">
              <For each={results()}>
                {(r) => (
                  <div class="flex items-center justify-between text-md font-mono py-1.5 px-2 border-b border-white/5 last:border-b-0">
                    <div class="flex items-center gap-2 truncate">
                      {r.ok ? (
                        <CheckCircle2 size={14} class="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle size={14} class="text-red-400 shrink-0" />
                      )}
                      <span class="truncate">{r.destPath ? r.destPath.split(/[/\\]/).pop() : r.sourcePath.split(/[/\\]/).pop()}</span>
                    </div>
                    {!r.ok && <span class="text-red-400 text-md shrink-0 ml-2">{r.error}</span>}
                  </div>
                )}
              </For>
            </div>
          </div>
        }
      >
        <div class="flex flex-col gap-5 text-md">
          {/* Region Export Callout (if active) */}
          <Show when={hasRegion()}>
            <div id="export-region-banner" class="flex items-center justify-between px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-[3px] text-md">
              <div class="flex items-center gap-2 text-amber-300 font-medium">
                <Scissors size={15} class="shrink-0" />
                <span>Exporting Selection Only</span>
              </div>
              <span class="font-mono text-amber-200/90 text-md">{regionInfo()}</span>
            </div>
          </Show>

          {/* Quick Presets */}
          <div id="export-preset-bar" class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-md">
              <span class="font-medium text-[var(--text-main)] flex items-center gap-1.5">
                <Sparkles size={14} class="text-[var(--accent-color)]" />
                <span>Presets</span>
              </span>
              <span class="text-md text-[var(--text-muted)] font-mono">1-click setup</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <Button
                id="export-preset-cd"
                variant={activePreset() === 'cd' ? 'primary' : 'default'}
                size="sm"
                onClick={() => applyPreset('cd')}
                class="justify-center"
              >
                CD Audio (16b/44k)
              </Button>
              <Button
                id="export-preset-game"
                variant={activePreset() === 'game' ? 'primary' : 'default'}
                size="sm"
                onClick={() => applyPreset('game')}
                class="justify-center"
              >
                Game / Film (24b/48k)
              </Button>
              <Button
                id="export-preset-web"
                variant={activePreset() === 'web' ? 'primary' : 'default'}
                size="sm"
                onClick={() => applyPreset('web')}
                class="justify-center"
              >
                Web OGG (192k)
              </Button>
            </div>
          </div>

          <div class="h-[1px] bg-[var(--border-color)]" />

          {/* Format & Audio Quality Configuration */}
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <label class="font-medium text-[var(--text-main)]">Format</label>
              <SegmentedControl
                id="export-format-control"
                value={format()}
                onChange={(val) => {
                  setActivePreset(null);
                  setFormat(val as ExportFormat);
                }}
                items={[
                  { id: 'wav', label: 'WAV' },
                  { id: 'ogg', label: 'OGG Vorbis' },
                ]}
              />
            </div>

            <Show
              when={format() === 'wav'}
              fallback={
                <div class="flex flex-col gap-2 p-3 bg-black/20 border border-[var(--border-color)] rounded-[3px]">
                  <div class="flex justify-between items-center text-md">
                    <span class="font-medium text-[var(--text-main)]">OGG Quality Level</span>
                    <span class="font-mono text-md text-[var(--accent-color)] font-semibold">
                      Q{oggQuality()} · {OGG_BITRATES[oggQuality()]}
                    </span>
                  </div>
                  <Slider
                    value={oggQuality()}
                    min={0}
                    max={10}
                    step={1}
                    showValue={false}
                    onChange={(val) => {
                      setActivePreset(null);
                      setOggQuality(Math.round(val));
                    }}
                  />
                  <div class="flex justify-between text-md font-mono text-[var(--text-muted)]">
                    <span>Q0 (Small file)</span>
                    <span>Q5 (Balanced)</span>
                    <span>Q10 (Near Lossless)</span>
                  </div>
                </div>
              }
            >
              <div class="flex items-center justify-between">
                <label class="font-medium text-[var(--text-main)]">Bit Depth</label>
                <SegmentedControl
                  id="export-bit-depth-control"
                  value={String(bitDepth())}
                  onChange={(val) => {
                    setActivePreset(null);
                    setBitDepth(parseInt(val, 10) as BitDepth);
                  }}
                  items={BIT_DEPTHS.map((bd) => ({ id: String(bd), label: `${bd}-bit` }))}
                />
              </div>
            </Show>

            <div class="flex items-center justify-between gap-4">
              <label class="font-medium text-[var(--text-main)] shrink-0">Sample Rate</label>
              <div class="w-64">
                <Select
                  id="export-sample-rate-select"
                  value={String(sampleRate())}
                  onChange={(val) => {
                    setActivePreset(null);
                    setSampleRate(parseInt(val, 10));
                  }}
                  options={SAMPLE_RATES.map((rate) => ({
                    value: String(rate),
                    label: `${rate >= 1000 ? `${rate / 1000} kHz` : `${rate} Hz`}${
                      rate === 44100 ? ' (CD Standard)' : rate === 48000 ? ' (Film / Video)' : ''
                    }`,
                  }))}
                  class="w-full"
                />
              </div>
            </div>
          </div>

          <div class="h-[1px] bg-[var(--border-color)]" />

          {/* Output Naming */}
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <label class="font-medium text-[var(--text-main)]">File Naming</label>
              <SegmentedControl
                id="export-naming-control"
                value={naming()}
                onChange={(val) => setNaming(val as NamingMode)}
                items={[
                  { id: 'original', label: 'Keep Original' },
                  { id: 'numeric', label: '01, 02, 03' },
                  { id: 'alpha', label: 'a, b, c' },
                ]}
              />
            </div>

            <Show when={naming() !== 'original'}>
              <div class="flex items-center justify-between gap-4 pt-1">
                <label class="text-md text-[var(--text-muted)] shrink-0">Base Name</label>
                <div class="w-64">
                  <TextInput
                    id="export-base-name-input"
                    value={baseName()}
                    onInput={(e) => setBaseName(e.currentTarget.value)}
                    placeholder="sound"
                    class="font-mono w-full"
                  />
                </div>
              </div>
            </Show>
          </div>

          {/* Resulting Output Preview */}
          <div class="flex flex-col gap-2 pt-1">
            <div class="flex items-center justify-between text-md">
              <span class="text-md font-mono text-[var(--text-muted)]">
                Output Preview ({props.files.length} {props.files.length === 1 ? 'file' : 'files'})
              </span>
            </div>

            <div class="flex flex-col gap-1.5 bg-black/25 border border-[var(--border-color)] rounded-[3px] p-2.5 max-h-32 overflow-y-auto dcc-scroll font-mono text-md">
              <For each={props.files.slice(0, 4)}>
                {(file, i) => (
                  <div class="flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 transition-colors">
                    <div class="flex items-center gap-2 truncate">
                      <FileAudio size={14} class="text-emerald-400 shrink-0" />
                      <span class="text-emerald-400 font-semibold truncate">{previewName(i())}</span>
                    </div>
                    <Show when={naming() !== 'original'}>
                      <span class="text-md text-[var(--text-muted)] truncate max-w-[180px] shrink-0 ml-2 opacity-75">
                        ← {file.filename}
                      </span>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={props.files.length > 4}>
                <div class="text-md text-[var(--text-muted)] italic pt-1 border-t border-white/5 text-center">
                  + {props.files.length - 4} more files
                </div>
              </Show>
            </div>
          </div>

          {/* Progress Bar when exporting */}
          <Show when={exporting() && progress()}>
            <div class="p-3 bg-[#1e2022] border border-[#007acc] rounded-[3px] shadow-lg">
              <ProgressBar
                value={Math.round((progress()!.done / Math.max(1, progress()!.total)) * 100)}
                label="Exporting batch audio..."
                statusText={`${progress()!.done} of ${progress()!.total} files converted`}
              />
            </div>
          </Show>
        </div>
      </Show>
    </Modal>
  );
}

