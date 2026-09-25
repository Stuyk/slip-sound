import { Show } from 'solid-js';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { SearchInput } from '../ui/SearchInput';
import { SegmentedControl } from '../ui/SegmentedControl';
import {
  FolderOpenIcon,
  XIcon,
  TagIcon,
  StarIcon,
  FilterXIcon,
  ZapIcon,
  SettingsIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../icons';

export interface WorkstationRibbonProps {
  hasFolder: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedCategory: string;
  selectedSubcategory: string;
  onClearCategory: () => void;
  query: string;
  onInputQuery: (query: string) => void;
  matchingCount: number;
  resultsCount: number;
  channels: string;
  onChangeChannels: (channels: string) => void;
  maxDuration: string;
  onChangeMaxDuration: (duration: string) => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  autoPlay: boolean;
  onToggleAutoPlay: () => void;
  onOpenSettings: () => void;
  onOpenFolder: () => void;
  searchInputRef?: (el: HTMLInputElement) => void;
}

export function WorkstationRibbon(props: WorkstationRibbonProps) {
  return (
    <div
      id="workstation-ribbon"
      class="h-11 min-h-[44px] bg-[#32353a] border-b border-[#1c1d1f] px-3 py-1.5 flex items-center justify-between gap-2.5 shrink-0 select-none text-md"
    >
      {/* Left Section: Context Actions & Search */}
      <div id="ribbon-left-section" class="flex items-center gap-2 flex-1 min-w-0">
        <Show when={props.hasFolder}>
          <div class="relative flex items-center">
            <IconButton
              id="ribbon-toggle-sidebar-btn"
              size="sm"
              onClick={props.onToggleSidebar}
              active={props.sidebarOpen}
              tooltip={props.sidebarOpen ? 'Collapse Categories (Ctrl+B)' : 'Expand Categories (Ctrl+B)'}
            >
              <Show when={props.sidebarOpen} fallback={<ChevronRightIcon size={14} />}>
                <ChevronLeftIcon size={14} />
              </Show>
            </IconButton>
            <Show when={props.selectedCategory}>
              <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#007acc] ring-2 ring-[#32353a]" />
            </Show>
          </div>

          <div class="h-4 w-px bg-[#1c1d1f] mx-1" />

          <div id="ribbon-search-container" class="flex-1 max-w-sm">
            <SearchInput
              id="ribbon-search-input"
              ref={props.searchInputRef}
              value={props.query}
              onInput={props.onInputQuery}
              placeholder="Search sounds… (Ctrl+F)"
              count={{ current: props.resultsCount, total: props.matchingCount }}
              onClear={() => props.onInputQuery('')}
              autofocus
            />
          </div>

          {/* Active Category Filter Chip */}
          <Show when={props.selectedCategory}>
            <div id="ribbon-active-category-chip" class="inline-flex items-center gap-1.5 h-8 min-h-[32px] px-2.5 rounded-[3px] bg-[#007acc]/20 border border-[#007acc] text-[#f0f3f6] text-md font-mono shrink-0">
              <TagIcon size={12} class="text-[#007acc]" />
              <span class="font-semibold truncate max-w-[120px]">{props.selectedCategory}</span>
              <Show when={props.selectedSubcategory}>
                <span class="opacity-50">/</span>
                <span class="truncate max-w-[100px]">{props.selectedSubcategory}</span>
              </Show>
              <button
                id="ribbon-clear-category-btn"
                type="button"
                class="ml-1 hover:text-white transition-colors cursor-pointer"
                onClick={props.onClearCategory}
                title="Clear category filter"
              >
                <XIcon size={12} />
              </button>
            </div>
          </Show>
        </Show>

        <Show when={!props.hasFolder}>
          <Button
            id="ribbon-open-folder-btn"
            variant="primary"
            size="sm"
            onClick={props.onOpenFolder}
            icon={<FolderOpenIcon size={13} />}
            title="Open Sound Folder (Ctrl+O)"
          >
            <span>Open Sound Folder</span>
          </Button>
        </Show>
      </div>

      {/* Right Section: Filters & Utility Toggles */}
      <div id="ribbon-right-section" class="flex items-center gap-1.5 shrink-0">
        <Show when={props.hasFolder}>
          <SegmentedControl
            id="ribbon-channels-control"
            value={props.channels}
            onChange={props.onChangeChannels}
            items={[
              { id: '', label: 'All' },
              { id: '1', label: 'Mono' },
              { id: '2', label: 'Stereo' },
            ]}
            size="sm"
          />

          <div
            id="ribbon-duration-filter"
            class="flex items-center h-8 min-h-[32px] px-2 rounded-[3px] bg-[#1e2022] border border-[#1c1d1f] text-md text-[#8b949e] gap-1.5 focus-within:border-[#007acc]"
            title="Filter sounds shorter than or equal to max duration"
          >
            <ClockIcon size={13} class="text-[#8b949e] shrink-0" />
            <span class="text-md font-medium uppercase tracking-wider text-[#8b949e]">Max</span>
            <input
              id="ribbon-duration-input"
              type="number"
              class="w-12 bg-transparent text-md text-[#f0f3f6] font-mono focus:outline-none tabular-nums text-right"
              placeholder="∞"
              min="0"
              step="0.5"
              value={props.maxDuration}
              onInput={(e) => props.onChangeMaxDuration(e.currentTarget.value)}
            />
            <span class="text-md text-[#8b949e]">s</span>
            <Show when={props.maxDuration}>
              <button
                id="ribbon-clear-duration-btn"
                type="button"
                class="w-4 h-4 flex items-center justify-center rounded text-[#8b949e] hover:text-[#f0f3f6] transition-colors cursor-pointer"
                onClick={() => props.onChangeMaxDuration('')}
                title="Clear duration filter"
              >
                <XIcon size={11} />
              </button>
            </Show>
          </div>

          <Button
            id="ribbon-favorites-btn"
            variant={props.favoritesOnly ? 'accent' : 'default'}
            size="sm"
            onClick={props.onToggleFavorites}
            icon={<StarIcon size={12} filled={props.favoritesOnly} />}
            title="Show favorites only"
          >
            <span>Favorites</span>
          </Button>

          <IconButton
            id="ribbon-clear-filters-btn"
            size="sm"
            active={props.hasActiveFilters}
            onClick={props.onClearFilters}
            disabled={!props.hasActiveFilters}
            tooltip={props.hasActiveFilters ? 'Clear all filters' : 'No active filters'}
          >
            <FilterXIcon size={13} />
          </IconButton>

          <div class="h-4 w-px bg-[#1c1d1f] mx-1" />

          {/* Autoplay Toggle Control */}
          <button
            id="ribbon-autoplay-btn"
            type="button"
            onClick={props.onToggleAutoPlay}
            class="h-8 min-h-[32px] px-2.5 rounded-[3px] border text-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer select-none"
            classList={{
              'bg-[#007acc]/20 border-[#007acc] text-[#f0f3f6] shadow-xs': props.autoPlay,
              'bg-[#26282b] border-[#1c1d1f] text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]': !props.autoPlay
            }}
            title="Toggle auto-play when selecting a sound (Alt+A)"
          >
            <ZapIcon
              size={13}
              class={props.autoPlay ? 'text-[#007acc]' : 'text-[#8b949e]'}
            />
            <span class="text-md">Auto-Play</span>
            <span
              id="ribbon-autoplay-indicator"
              class="px-1.5 py-0.2 rounded text-[11px] font-bold uppercase tracking-wider ml-0.5"
              classList={{
                'bg-[#007acc] text-white': props.autoPlay,
                'bg-[#1c1d1f] text-[#8b949e]': !props.autoPlay
              }}
            >
              {props.autoPlay ? 'ON' : 'OFF'}
            </span>
          </button>
        </Show>

        <IconButton id="ribbon-settings-btn" size="sm" onClick={props.onOpenSettings} tooltip="Settings">
          <SettingsIcon size={14} />
        </IconButton>
      </div>
    </div>
  );
}
