import { Show } from 'solid-js';
import type { SoundRow } from '../../../../preload/index';
import { Badge } from '../ui/Badge';
import { DragExportsMenu } from './DragExportsMenu';
import {
  DatabaseIcon,
  InfinityIcon,
  ZapIcon,
  KeyboardIcon,
} from '../icons';

export interface WorkstationStatusBarProps {
  folder: { folder: string; count: number } | null;
  resultsCount: number;
  matchingCount: number;
  multiSelectedCount: number;
  infiniteScroll: boolean;
  onToggleInfiniteScroll: () => void;
  autoPlay: boolean;
  onToggleAutoPlay: () => void;
  selectedRow: SoundRow | null;
  formatSize: (bytes?: number) => string;
  onOpenHelp: () => void;
  // Background renders for a processed drag-out, while in progress.
}

export function WorkstationStatusBar(props: WorkstationStatusBarProps) {
  return (
    <footer id="workstation-status-bar" class="h-8 min-h-[32px] bg-[#26282b] border-t border-[#1c1d1f] px-3 flex items-center justify-between text-md text-[#8b949e] select-none shrink-0">
      {/* Left Section: Library and Count Info */}
      <div id="status-bar-left-section" class="flex items-center gap-3">
        <Show
          when={props.folder}
          fallback={
            <div id="status-bar-ready-indicator" class="flex items-center gap-1.5 text-md text-[#8b949e]">
              <DatabaseIcon size={12} />
              <span>Ready</span>
            </div>
          }
        >
          <div id="status-bar-folder-label" class="flex items-center gap-1.5 text-md text-[#f0f3f6] font-medium" title={props.folder!.folder}>
            <DatabaseIcon size={12} class="text-[#007acc]" />
            <span class="max-w-[200px] truncate">
              {props.folder!.folder.split(/[/\\]/).pop() || props.folder!.folder}
            </span>
          </div>

          <div id="status-bar-total-sounds" class="text-md text-[#8b949e]">
            <span>{props.folder!.count} Total Sounds</span>
          </div>

          <div
            id="status-bar-matching-sounds"
            class="text-md text-[#8b949e] font-mono tabular-nums"
            title={`${props.resultsCount} loaded of ${props.matchingCount} matching sounds`}
          >
            <span>
              {props.resultsCount === props.matchingCount
                ? `${props.matchingCount} shown`
                : `${props.resultsCount} / ${props.matchingCount} shown`}
            </span>
          </div>

          <Show when={props.matchingCount !== props.folder!.count}>
            <Badge id="status-bar-filtered-badge" variant="accent" class="text-md py-0 px-1.5">
              Filtered
            </Badge>
          </Show>

          <Show when={props.multiSelectedCount > 0}>
            <Badge id="status-bar-selected-badge" variant="accent" class="text-md py-0 px-1.5 font-bold">
              {props.multiSelectedCount} selected
            </Badge>
          </Show>
        </Show>
      </div>

      {/* Right Section: Toggles & Sound Specs */}
      <div id="status-bar-right-section" class="flex items-center gap-2">
        <DragExportsMenu />

        <button
          id="status-bar-infinite-scroll-btn"
          type="button"
          class="h-7 min-h-[28px] px-2.5 rounded-[3px] border text-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
          classList={{
            'bg-[#007acc]/15 border-[#007acc]/40 text-[#f0f3f6]': props.infiniteScroll,
            'bg-[#1e2022] border-[#1c1d1f] text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]': !props.infiniteScroll,
          }}
          onClick={props.onToggleInfiniteScroll}
          title={`Toggle Infinite Scroll. Currently: ${props.infiniteScroll ? 'ON' : 'OFF'}`}
        >
          <InfinityIcon size={12} class={props.infiniteScroll ? 'text-[#007acc]' : 'text-zinc-500'} />
          <span>Infinite Scroll: {props.infiniteScroll ? 'ON' : 'OFF'}</span>
        </button>

        <button
          id="status-bar-autoplay-btn"
          type="button"
          class="h-7 min-h-[28px] px-2.5 rounded-[3px] border text-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
          classList={{
            'bg-[#007acc]/15 border-[#007acc]/40 text-[#f0f3f6]': props.autoPlay,
            'bg-[#1e2022] border-[#1c1d1f] text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]': !props.autoPlay,
          }}
          onClick={props.onToggleAutoPlay}
          title={`Toggle Auto-play on select (Alt+A). Currently: ${props.autoPlay ? 'ON' : 'OFF'}`}
        >
          <ZapIcon size={12} class={props.autoPlay ? 'text-[#007acc]' : 'text-zinc-500'} />
          <span>Auto-play: {props.autoPlay ? 'ON' : 'OFF'}</span>
        </button>

        <Show when={props.selectedRow}>
          <div id="status-bar-sound-specs" class="text-md font-mono text-[#8b949e] tabular-nums px-1.5">
            <span>
              {props.selectedRow!.channels === 1
                ? 'Mono'
                : props.selectedRow!.channels === 2
                ? 'Stereo'
                : ''}{' '}
              {props.selectedRow!.sample_rate ? `• ${props.selectedRow!.sample_rate} Hz` : ''}{' '}
              {props.selectedRow!.filesize ? `• ${props.formatSize(props.selectedRow!.filesize)}` : ''}
            </span>
          </div>
        </Show>

        <button
          id="status-bar-shortcuts-btn"
          type="button"
          class="h-7 min-h-[28px] px-2 rounded-[3px] flex items-center gap-1.5 text-md text-[#8b949e] hover:text-[#f0f3f6] hover:bg-white/5 transition-colors cursor-pointer"
          onClick={props.onOpenHelp}
          title="Open Hotkeys & Quick Guide (?)"
        >
          <KeyboardIcon size={12} />
          <span>Shortcuts (?)</span>
        </button>
      </div>
    </footer>
  );
}
