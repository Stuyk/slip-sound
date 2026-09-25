import { For, Show } from 'solid-js';
import type { SoundRow, SortColumn, SortDir } from '../../../../preload/index';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Badge } from '../ui/Badge';
import {
  GripVerticalIcon,
  DownloadIcon,
  TagPlusIcon,
  TagXIcon,
  XIcon,
  StarIcon,
  FileAudioIcon,
  TagIcon,
  ClockIcon,
  SlidersIcon,
  ActivityIcon,
  HardDriveIcon,
  FolderIcon,
  RefreshCwIcon,
  SearchIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '../icons';

export interface SoundTableProps {
  results: SoundRow[];
  selected: number;
  multiSelected: Map<string, SoundRow>;
  multiSelectTotalSize: number;
  sortBy?: SortColumn;
  sortDir: SortDir;
  loadingMore: boolean;
  matchingCount: number;
  infiniteScroll: boolean;
  listContainerRef?: (el: HTMLDivElement) => void;
  onListScroll?: (e: Event) => void;
  onToggleSort: (column: SortColumn) => void;
  onRowClick: (index: number, e: MouseEvent) => void;
  onRowDblClick: (index: number, e: MouseEvent) => void;
  onRowDragStart: (index: number, e: DragEvent) => void;
  onToggleFavorite: (row: SoundRow, e: MouseEvent) => void;
  onOpenCategoryModal: (row: SoundRow) => void;
  onRevealRow: (row: SoundRow, e: MouseEvent) => void;
  onExportRow: (row: SoundRow, e: MouseEvent) => void;
  onExportSelected: () => void;
  onCategorizeSelected: () => void;
  onClearCategorySelected: () => void;
  onClearMultiSelection: () => void;
  onLoadMore: () => void;
  formatDuration: (s?: number | null) => string;
  formatSize: (bytes?: number | null) => string;
}

const TABLE_GRID = 'grid-cols-[44px_minmax(220px,2fr)_minmax(160px,1.2fr)_105px_95px_115px_100px_76px]';

function SortIcon(props: { column: SortColumn; sortBy?: SortColumn; sortDir: SortDir }) {
  const isActive = () => props.sortBy === props.column;
  return (
    <Show
      when={isActive()}
      fallback={
        <ChevronUpIcon size={14} class="opacity-0 group-hover:opacity-30 text-[#8b949e] shrink-0 transition-opacity" />
      }
    >
      {props.sortDir === 'asc' ? (
        <ChevronUpIcon size={14} class="text-[#007acc] shrink-0" />
      ) : (
        <ChevronDownIcon size={14} class="text-[#007acc] shrink-0" />
      )}
    </Show>
  );
}

export function SoundTable(props: SoundTableProps) {
  return (
    <div id="sound-table-container" class="flex-1 flex flex-col min-w-0 bg-[#2b2d30] overflow-hidden relative">
      {/* Multi-Select Floating Notification */}
      <Show when={props.multiSelected.size > 0}>
        <div id="sound-table-multiselect-bar" class="flex items-center justify-between px-3 py-1.5 bg-[#007acc] text-white text-md font-medium border-b border-[#005f9e] shadow-xs select-none shrink-0">
          <div class="flex items-center gap-2">
            <GripVerticalIcon size={14} />
            <span>
              {props.multiSelected.size} sounds selected ({props.formatSize(props.multiSelectTotalSize)}) — Drag out to copy into DAW or folder
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Button
              id="multiselect-btn-export"
              variant="default"
              size="xs"
              icon={<DownloadIcon size={12} />}
              title="Export Selected…"
              onClick={props.onExportSelected}
            >
              Export
            </Button>
            <Button
              id="multiselect-btn-categorize"
              variant="default"
              size="xs"
              icon={<TagPlusIcon size={12} />}
              title="Set Category…"
              onClick={props.onCategorizeSelected}
            >
              Categorize
            </Button>
            <Button
              id="multiselect-btn-clear-cat"
              variant="default"
              size="xs"
              icon={<TagXIcon size={12} />}
              title="Clear Category"
              onClick={props.onClearCategorySelected}
            >
              Clear Cat
            </Button>
            <IconButton
              id="multiselect-btn-close"
              size="xs"
              tooltip="Clear selection"
              onClick={props.onClearMultiSelection}
            >
              <XIcon size={12} />
            </IconButton>
          </div>
        </div>
      </Show>

      {/* Sound Results Table Header */}
      <div
        id="sound-table-header"
        class={`grid ${TABLE_GRID} gap-3 px-4 h-10 min-h-[40px] items-center bg-[#26282b] border-b border-[#1c1d1f] text-md font-semibold tracking-wider text-[#8b949e] select-none shrink-0 overflow-y-scroll dcc-scroll [&::-webkit-scrollbar-thumb]:bg-transparent`}
      >
        <div
          id="th-favorite"
          class="flex items-center justify-center cursor-pointer h-full transition-colors group select-none py-1"
          classList={{
            'text-[#007acc]': props.sortBy === 'favorite',
            'hover:text-[#f0f3f6]': props.sortBy !== 'favorite',
          }}
          onClick={() => props.onToggleSort('favorite')}
          title="Sort by favorite"
        >
          <div class="flex items-center gap-0.5">
            <StarIcon size={14} filled={props.sortBy === 'favorite'} />
            <SortIcon column="favorite" sortBy={props.sortBy} sortDir={props.sortDir} />
          </div>
        </div>

        <div
          id="th-sound-name"
          class="flex items-center gap-1.5 cursor-pointer h-full transition-colors group select-none truncate"
          classList={{
            'text-[#007acc] font-semibold': props.sortBy === 'filename',
            'hover:text-[#f0f3f6]': props.sortBy !== 'filename',
          }}
          onClick={() => props.onToggleSort('filename')}
          title="Sort by Sound Name"
        >
          <FileAudioIcon size={14} class="shrink-0" />
          <span class="truncate">Sound Name</span>
          <SortIcon column="filename" sortBy={props.sortBy} sortDir={props.sortDir} />
        </div>

        <div
          id="th-category"
          class="flex items-center gap-1.5 cursor-pointer h-full transition-colors group select-none truncate"
          classList={{
            'text-[#007acc] font-semibold': props.sortBy === 'category',
            'hover:text-[#f0f3f6]': props.sortBy !== 'category',
          }}
          onClick={() => props.onToggleSort('category')}
          title="Sort by Category"
        >
          <TagIcon size={14} class="shrink-0" />
          <span class="truncate">Category</span>
          <SortIcon column="category" sortBy={props.sortBy} sortDir={props.sortDir} />
        </div>

        <div
          id="th-duration"
          class="flex items-center justify-end gap-1.5 cursor-pointer h-full transition-colors group select-none text-right"
          classList={{
            'text-[#007acc] font-semibold': props.sortBy === 'duration',
            'hover:text-[#f0f3f6]': props.sortBy !== 'duration',
          }}
          onClick={() => props.onToggleSort('duration')}
          title="Sort by Duration"
        >
          <ClockIcon size={14} class="shrink-0" />
          <span>Duration</span>
          <SortIcon column="duration" sortBy={props.sortBy} sortDir={props.sortDir} />
        </div>

        <div
          id="th-channels"
          class="flex items-center gap-1.5 cursor-pointer h-full transition-colors group select-none"
          classList={{
            'text-[#007acc] font-semibold': props.sortBy === 'channels',
            'hover:text-[#f0f3f6]': props.sortBy !== 'channels',
          }}
          onClick={() => props.onToggleSort('channels')}
          title="Sort by Channels"
        >
          <SlidersIcon size={14} class="shrink-0" />
          <span>Channels</span>
          <SortIcon column="channels" sortBy={props.sortBy} sortDir={props.sortDir} />
        </div>

        <div
          id="th-sample-rate"
          class="flex items-center justify-end gap-1.5 cursor-pointer h-full transition-colors group select-none text-right"
          classList={{
            'text-[#007acc] font-semibold': props.sortBy === 'sample_rate',
            'hover:text-[#f0f3f6]': props.sortBy !== 'sample_rate',
          }}
          onClick={() => props.onToggleSort('sample_rate')}
          title="Sort by Sample Rate"
        >
          <ActivityIcon size={14} class="shrink-0" />
          <span>Rate</span>
          <SortIcon column="sample_rate" sortBy={props.sortBy} sortDir={props.sortDir} />
        </div>

        <div
          id="th-filesize"
          class="flex items-center justify-end gap-1.5 cursor-pointer h-full transition-colors group select-none text-right"
          classList={{
            'text-[#007acc] font-semibold': props.sortBy === 'filesize',
            'hover:text-[#f0f3f6]': props.sortBy !== 'filesize',
          }}
          onClick={() => props.onToggleSort('filesize')}
          title="Sort by File Size"
        >
          <HardDriveIcon size={14} class="shrink-0" />
          <span>Size</span>
          <SortIcon column="filesize" sortBy={props.sortBy} sortDir={props.sortDir} />
        </div>

        <div id="th-actions" class="flex items-center justify-center text-[#8b949e] font-medium" title="Actions">
          <span>Actions</span>
        </div>
      </div>

      {/* Sound Results Rows with Infinite Scroll */}
      <div
        id="sound-table-body"
        class="flex-1 overflow-y-scroll min-h-0 dcc-scroll select-none bg-[#2b2d30]"
        ref={props.listContainerRef}
        onScroll={props.onListScroll}
      >
        <For
          each={props.results}
          fallback={
            <div id="sound-table-empty-state" class="flex flex-col items-center justify-center p-12 text-[#8b949e] gap-2">
              <SearchIcon size={24} class="opacity-30" />
              <span class="text-md">No sounds match the current filter</span>
            </div>
          }
        >
          {(row, i) => (
            <div
              id={`sound-row-${i()}`}
              class={`grid ${TABLE_GRID} gap-3 px-4 h-10 min-h-[40px] items-center border-b border-[#1c1d1f]/60 cursor-pointer text-md transition-colors group even:bg-[#282a2d] odd:bg-[#2b2d30] hover:bg-[#34383d]`}
              classList={{
                'bg-[#007acc]/25! hover:bg-[#007acc]/30! text-[#f0f3f6] border-l-4 border-l-[#007acc] border-b-[#007acc]/40 font-medium': i() === props.selected,
                'bg-[#007acc]/15! border-l-2 border-l-[#007acc]/60': props.multiSelected.has(row.path) && i() !== props.selected,
                'text-[#8b949e]': i() !== props.selected,
              }}
              data-idx={i()}
              draggable={true}
              onClick={(e) => props.onRowClick(i(), e)}
              onDblClick={(e) => props.onRowDblClick(i(), e)}
              onDragStart={(e) => props.onRowDragStart(i(), e)}
              title={row.path}
            >
              <div class="flex items-center justify-center">
                <button
                  type="button"
                  class="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-[3px] text-[#8b949e] hover:text-amber-400 hover:bg-white/10 transition-colors cursor-pointer"
                  classList={{ 'text-amber-400!': row.favorite }}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleFavorite(row, e);
                  }}
                  title={row.favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <StarIcon size={14} filled={row.favorite} />
                </button>
              </div>

              <div class="flex items-center gap-2 truncate">
                <FileAudioIcon size={14} class="shrink-0 text-[#007acc]" />
                <span class="truncate font-medium text-[#f0f3f6]">{row.filename}</span>
              </div>

              <div
                class="flex items-center truncate cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onOpenCategoryModal(row);
                }}
                title="Click to set category"
              >
                <Show
                  when={row.category && row.category !== 'Uncategorized'}
                  fallback={
                    <span class="text-[#8b949e]/40 hover:text-[#8b949e] transition-colors p-1">
                      <TagPlusIcon size={14} />
                    </span>
                  }
                >
                  <Badge
                    variant={row.category_manual ? 'accent' : 'default'}
                    class="max-w-full truncate"
                    title={`${row.category}${row.subcategory ? ' > ' + row.subcategory : ''}${row.category_manual ? ' (manually set)' : ` (confidence ${(row.confidence * 100).toFixed(0)}%)`}`}
                  >
                    {row.subcategory ? `${row.category} / ${row.subcategory}` : row.category}
                  </Badge>
                </Show>
              </div>

              <div class="text-right font-mono text-md text-[#8b949e] tabular-nums truncate group-hover:text-[#c9d1d9]">
                {props.formatDuration(row.duration)}
              </div>

              <div class="flex items-center justify-start truncate">
                <span class="px-1.5 py-0.5 rounded-[3px] bg-[#1e2022] text-[#8b949e] border border-[#1c1d1f] font-mono text-md group-hover:text-[#c9d1d9]">
                  {row.channels === 1 ? 'Mono' : row.channels === 2 ? 'Stereo' : row.channels ? `${row.channels}ch` : '-'}
                </span>
              </div>

              <div class="text-right font-mono text-md text-[#8b949e] tabular-nums truncate group-hover:text-[#c9d1d9]">
                {row.sample_rate ? `${row.sample_rate} Hz` : '-'}
              </div>

              <div class="text-right font-mono text-md text-[#8b949e] tabular-nums truncate group-hover:text-[#c9d1d9]">
                {props.formatSize(row.filesize)}
              </div>

              <div class="flex items-center justify-center gap-1.5">
                <IconButton
                  size="xs"
                  onClick={(e) => props.onRevealRow(row, e)}
                  tooltip="Reveal in file manager"
                >
                  <FolderIcon size={14} />
                </IconButton>
                <IconButton
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onExportRow(row, e);
                  }}
                  tooltip="Export this sound"
                >
                  <DownloadIcon size={14} />
                </IconButton>
              </div>
            </div>
          )}
        </For>

        {/* Infinite Scroll Footer */}
        <Show when={props.results.length > 0}>
          <div id="sound-table-footer" class="py-3 px-4 flex items-center justify-center text-md text-[#8b949e] border-t border-[#1c1d1f]">
            <Show when={props.loadingMore}>
              <div id="sound-table-loading-more" class="flex items-center gap-2">
                <RefreshCwIcon size={14} class="animate-spin text-[#007acc]" />
                <span>Loading more sounds…</span>
              </div>
            </Show>
            <Show when={!props.loadingMore && props.results.length < props.matchingCount && !props.infiniteScroll}>
              <Button id="sound-table-btn-load-more" variant="default" size="sm" onClick={props.onLoadMore}>
                <span>Load Next 100 Sounds ({props.results.length} of {props.matchingCount} loaded)</span>
              </Button>
            </Show>
            <Show when={!props.loadingMore && props.results.length >= props.matchingCount && props.matchingCount > 50}>
              <span id="sound-table-all-loaded" class="font-mono text-md text-[#8b949e]">All {props.matchingCount} sounds loaded</span>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

