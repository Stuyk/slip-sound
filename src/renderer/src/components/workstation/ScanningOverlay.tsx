import { Show } from 'solid-js';
import { ProgressBar } from '../ui/ProgressBar';
import { RefreshCwIcon } from '../icons';

export interface ScanningOverlayProps {
  isOpen: boolean;
  progress: { done: number; total: number } | null;
  progressPct: number;
}

export function ScanningOverlay(props: ScanningOverlayProps) {
  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none">
        <div class="bg-[#32353a] border border-[#1c1d1f] rounded-[3px] p-5 flex flex-col items-center gap-3 w-80 shadow-2xl">
          <RefreshCwIcon size={24} class="animate-spin text-[#007acc]" />
          <div class="text-[#f0f3f6] font-bold text-md uppercase tracking-wider">Scanning Sound Library…</div>
          <div class="w-full">
            <ProgressBar
              value={props.progressPct}
              statusText={props.progress ? `${props.progress.done} / ${props.progress.total} files` : 'Scanning directory…'}
            />
          </div>
        </div>
      </div>
    </Show>
  );
}
