import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import {
  FolderOpen,
  RefreshCw,
  X,
  Download,
  Settings,
  HelpCircle,
  Folder,
  Tag,
  TagX,
  FilterX,
  Star,
  Check,
  PanelLeft,
  Infinity as InfinityIcon,
  Zap,
  Clock,
} from 'lucide-solid';
import { SearchInput } from '../ui/SearchInput';
import { SegmentedControl } from '../ui/SegmentedControl';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';

export interface WorkstationMenuBarProps {
  hasFolder: boolean;
  folderName?: string;
  hasSelection: boolean;
  selectionCount: number;
  sidebarOpen: boolean;
  infiniteScroll: boolean;
  autoPlay: boolean;
  favoritesOnly: boolean;
  channels: string;
  reindexing: boolean;
  query: string;
  onInputQuery: (query: string) => void;
  matchingCount: number;
  resultsCount: number;
  selectedCategory: string;
  selectedSubcategory: string;
  onClearCategory: () => void;
  maxDuration: string;
  onChangeMaxDuration: (duration: string) => void;
  hasActiveFilters: boolean;
  searchInputRef?: (el: HTMLInputElement) => void;
  onOpenFolder: () => void;
  onReindex: () => void;
  onCloseFolder: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSetCategory: () => void;
  onClearCategorySelection: () => void;
  onClearFilters: () => void;
  onToggleFavorites: () => void;
  onSetChannels: (ch: string) => void;
  onToggleSidebar: () => void;
  onToggleInfiniteScroll: () => void;
  onToggleAutoPlay: () => void;
  onOpenHelp: () => void;
}

export function WorkstationMenuBar(props: WorkstationMenuBarProps) {
  const [activeMenu, setActiveMenu] = createSignal<string | null>(null);
  let navRef: HTMLElement | undefined;

  function handleClickOutside(e: MouseEvent) {
    if (navRef && !navRef.contains(e.target as Node)) {
      setActiveMenu(null);
    }
  }

  onMount(() => document.addEventListener('mousedown', handleClickOutside));
  onCleanup(() => document.removeEventListener('mousedown', handleClickOutside));

  function handleMenuHover(menuId: string) {
    if (activeMenu() !== null) {
      setActiveMenu(menuId);
    }
  }

  function runAction(action: () => void) {
    setActiveMenu(null);
    action();
  }

  return (
    <nav
      id="workstation-menubar"
      ref={navRef}
      class="h-11 min-h-[44px] bg-[#26282b] border-b border-[#1c1d1f] flex items-center px-3 gap-2 select-none text-md font-sans shrink-0 z-30"
    >
      {/* Menus Row */}
      <div id="menubar-items-group" class="flex items-center gap-1 shrink-0">
        {/* FILE MENU */}
        <div id="menu-file-container" class="relative">
          <button
            id="menu-trigger-file"
            type="button"
            class={`h-7 min-h-[28px] px-2.5 rounded-[3px] text-md flex items-center font-medium transition-colors cursor-pointer ${
              activeMenu() === 'file'
                ? 'bg-[#007acc] text-white font-semibold'
                : 'text-[#f0f3f6] hover:bg-white/10'
            }`}
            onClick={() => setActiveMenu(activeMenu() === 'file' ? null : 'file')}
            onMouseEnter={() => handleMenuHover('file')}
          >
            File
          </button>
          <Show when={activeMenu() === 'file'}>
            <div id="menu-dropdown-file" class="absolute left-0 top-full mt-1 w-72 bg-[#32353a] border border-[#1c1d1f] rounded-[3px] shadow-2xl py-1 z-50 text-md flex flex-col font-sans">
              <button
                id="menu-item-open-folder"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(props.onOpenFolder)}
              >
                <div class="flex items-center gap-2">
                  <FolderOpen size={13} />
                  <span>Open Sound Folder…</span>
                </div>
                <span class="text-md font-mono opacity-60">Ctrl+O</span>
              </button>

              <button
                id="menu-item-reindex"
                type="button"
                disabled={!props.hasFolder || props.reindexing}
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                onClick={() => runAction(props.onReindex)}
              >
                <div class="flex items-center gap-2">
                  <RefreshCw size={13} class={props.reindexing ? 'animate-spin' : ''} />
                  <span>Reindex Library</span>
                </div>
              </button>

              <Show when={props.hasFolder}>
                <button
                  id="menu-item-close-folder"
                  type="button"
                  class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                  onClick={() => runAction(props.onCloseFolder)}
                >
                  <div class="flex items-center gap-2">
                    <X size={13} />
                    <span>Close Library</span>
                  </div>
                </button>
              </Show>

              <div class="h-px bg-[#1c1d1f] my-1" />

              <button
                id="menu-item-export"
                type="button"
                disabled={!props.hasFolder}
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                onClick={() => runAction(props.onOpenExport)}
              >
                <div class="flex items-center gap-2">
                  <Download size={13} />
                  <span>Export Selection…</span>
                </div>
                <span class="text-md font-mono opacity-60">Ctrl+E</span>
              </button>

              <div class="h-px bg-[#1c1d1f] my-1" />

              <button
                id="menu-item-settings"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(props.onOpenSettings)}
              >
                <div class="flex items-center gap-2">
                  <Settings size={13} />
                  <span>Settings & MCP…</span>
                </div>
              </button>
            </div>
          </Show>
        </div>

        {/* EDIT MENU */}
        <div id="menu-edit-container" class="relative">
          <button
            id="menu-trigger-edit"
            type="button"
            class={`h-7 min-h-[28px] px-2.5 rounded-[3px] text-md flex items-center font-medium transition-colors cursor-pointer ${
              activeMenu() === 'edit'
                ? 'bg-[#007acc] text-white font-semibold'
                : 'text-[#f0f3f6] hover:bg-white/10'
            }`}
            onClick={() => setActiveMenu(activeMenu() === 'edit' ? null : 'edit')}
            onMouseEnter={() => handleMenuHover('edit')}
          >
            Edit
          </button>
          <Show when={activeMenu() === 'edit'}>
            <div id="menu-dropdown-edit" class="absolute left-0 top-full mt-1 w-72 bg-[#32353a] border border-[#1c1d1f] rounded-[3px] shadow-2xl py-1 z-50 text-md flex flex-col font-sans">
              <button
                id="menu-item-select-all"
                type="button"
                disabled={!props.hasFolder}
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                onClick={() => runAction(props.onSelectAll)}
              >
                <span>Select All Filtered</span>
                <span class="text-md font-mono opacity-60">Ctrl+A</span>
              </button>

              <button
                id="menu-item-clear-selection"
                type="button"
                disabled={!props.hasSelection}
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                onClick={() => runAction(props.onClearSelection)}
              >
                <span>Clear Selection</span>
                <span class="text-md font-mono opacity-60">Esc</span>
              </button>

              <div class="h-px bg-[#1c1d1f] my-1" />

              <button
                id="menu-item-set-category"
                type="button"
                disabled={!props.hasSelection}
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                onClick={() => runAction(props.onSetCategory)}
              >
                <div class="flex items-center gap-2">
                  <Tag size={13} />
                  <span>Set Category…</span>
                </div>
              </button>

              <button
                id="menu-item-clear-category"
                type="button"
                disabled={!props.hasSelection}
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                onClick={() => runAction(props.onClearCategorySelection)}
              >
                <div class="flex items-center gap-2">
                  <TagX size={13} />
                  <span>Clear Category</span>
                </div>
              </button>

              <div class="h-px bg-[#1c1d1f] my-1" />

              <button
                id="menu-item-reset-filters"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(props.onClearFilters)}
              >
                <div class="flex items-center gap-2">
                  <FilterX size={13} />
                  <span>Reset All Filters</span>
                </div>
              </button>
            </div>
          </Show>
        </div>

        {/* SELECT MENU */}
        <div id="menu-select-container" class="relative">
          <button
            id="menu-trigger-select"
            type="button"
            class={`h-7 min-h-[28px] px-2.5 rounded-[3px] text-md flex items-center font-medium transition-colors cursor-pointer ${
              activeMenu() === 'select'
                ? 'bg-[#007acc] text-white font-semibold'
                : 'text-[#f0f3f6] hover:bg-white/10'
            }`}
            onClick={() => setActiveMenu(activeMenu() === 'select' ? null : 'select')}
            onMouseEnter={() => handleMenuHover('select')}
          >
            Select
          </button>
          <Show when={activeMenu() === 'select'}>
            <div id="menu-dropdown-select" class="absolute left-0 top-full mt-1 w-64 bg-[#32353a] border border-[#1c1d1f] rounded-[3px] shadow-2xl py-1 z-50 text-md flex flex-col font-sans">
              <button
                id="menu-item-toggle-favorites-filter"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(props.onToggleFavorites)}
              >
                <div class="flex items-center gap-2">
                  <Star size={13} />
                  <span>Favorites Only</span>
                </div>
                {props.favoritesOnly && <Check size={13} />}
              </button>

              <div class="h-px bg-[#1c1d1f] my-1" />

              <button
                id="menu-item-channels-all"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(() => props.onSetChannels(''))}
              >
                <span>Channels: All</span>
                {props.channels === '' && <Check size={13} />}
              </button>

              <button
                id="menu-item-channels-mono"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(() => props.onSetChannels('1'))}
              >
                <span>Channels: Mono Only</span>
                {props.channels === '1' && <Check size={13} />}
              </button>

              <button
                id="menu-item-channels-stereo"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(() => props.onSetChannels('2'))}
              >
                <span>Channels: Stereo Only</span>
                {props.channels === '2' && <Check size={13} />}
              </button>
            </div>
          </Show>
        </div>

        {/* VIEW MENU */}
        <div id="menu-view-container" class="relative">
          <button
            id="menu-trigger-view"
            type="button"
            class={`h-7 min-h-[28px] px-2.5 rounded-[3px] text-md flex items-center font-medium transition-colors cursor-pointer ${
              activeMenu() === 'view'
                ? 'bg-[#007acc] text-white font-semibold'
                : 'text-[#f0f3f6] hover:bg-white/10'
            }`}
            onClick={() => setActiveMenu(activeMenu() === 'view' ? null : 'view')}
            onMouseEnter={() => handleMenuHover('view')}
          >
            View
          </button>
          <Show when={activeMenu() === 'view'}>
            <div id="menu-dropdown-view" class="absolute left-0 top-full mt-1 w-72 bg-[#32353a] border border-[#1c1d1f] rounded-[3px] shadow-2xl py-1 z-50 text-md flex flex-col font-sans">
              <button
                id="menu-item-toggle-sidebar"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(props.onToggleSidebar)}
              >
                <div class="flex items-center gap-2">
                  <PanelLeft size={13} />
                  <span>Category Browser</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-md font-mono opacity-60">Ctrl+B</span>
                  {props.sidebarOpen && <Check size={13} />}
                </div>
              </button>

              <button
                id="menu-item-toggle-infinite-scroll"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(props.onToggleInfiniteScroll)}
              >
                <div class="flex items-center gap-2">
                  <InfinityIcon size={13} />
                  <span>Infinite Scroll</span>
                </div>
                {props.infiniteScroll && <Check size={13} />}
              </button>

              <button
                id="menu-item-toggle-autoplay"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(props.onToggleAutoPlay)}
              >
                <div class="flex items-center gap-2">
                  <Zap size={13} />
                  <span>Auto-play on Select</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-md font-mono opacity-60">Alt+A</span>
                  {props.autoPlay && <Check size={13} />}
                </div>
              </button>
            </div>
          </Show>
        </div>

        {/* HELP MENU */}
        <div id="menu-help-container" class="relative">
          <button
            id="menu-trigger-help"
            type="button"
            class={`h-7 min-h-[28px] px-2.5 rounded-[3px] text-md flex items-center font-medium transition-colors cursor-pointer ${
              activeMenu() === 'help'
                ? 'bg-[#007acc] text-white font-semibold'
                : 'text-[#f0f3f6] hover:bg-white/10'
            }`}
            onClick={() => setActiveMenu(activeMenu() === 'help' ? null : 'help')}
            onMouseEnter={() => handleMenuHover('help')}
          >
            Help
          </button>
          <Show when={activeMenu() === 'help'}>
            <div id="menu-dropdown-help" class="absolute left-0 top-full mt-1 w-64 bg-[#32353a] border border-[#1c1d1f] rounded-[3px] shadow-2xl py-1 z-50 text-md flex flex-col font-sans">
              <button
                id="menu-item-help-guide"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(props.onOpenHelp)}
              >
                <div class="flex items-center gap-2">
                  <HelpCircle size={13} />
                  <span>Quick Guide & Hotkeys</span>
                </div>
                <span class="text-md font-mono opacity-60">?</span>
              </button>

              <button
                id="menu-item-help-settings"
                type="button"
                class="px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white text-[#f0f3f6] text-left cursor-pointer transition-colors"
                onClick={() => runAction(props.onOpenSettings)}
              >
                <div class="flex items-center gap-2">
                  <Settings size={13} />
                  <span>Settings…</span>
                </div>
              </button>
            </div>
          </Show>
        </div>
      </div>

      {/* Vertical Divider */}
      <div class="h-4 w-px bg-[#1c1d1f] mx-1 shrink-0" />

      {/* Main Integrated Workspace Controls */}
      <div id="menubar-controls-group" class="flex items-center gap-2 flex-1 min-w-0">
        <Show when={props.hasFolder}>
          {/* Integrated Search Input - Expands to fill available room */}
          <div id="menubar-search-container" class="flex-1 min-w-[200px]">
            <SearchInput
              id="menubar-search-input"
              ref={props.searchInputRef}
              value={props.query}
              onInput={props.onInputQuery}
              placeholder="Search sounds… (Ctrl+F)"
              count={{ current: props.resultsCount, total: props.matchingCount }}
              onClear={() => props.onInputQuery('')}
            />
          </div>

          {/* Active Category Filter Chip */}
          <Show when={props.selectedCategory}>
            <div id="menubar-active-category-chip" class="inline-flex items-center gap-1.5 h-7 min-h-[28px] px-2 rounded-[3px] bg-[#007acc]/20 border border-[#007acc] text-[#f0f3f6] text-md font-mono shrink-0">
              <Tag size={11} class="text-[#007acc]" />
              <span class="font-semibold truncate max-w-[120px]">{props.selectedCategory}</span>
              <Show when={props.selectedSubcategory}>
                <span class="opacity-50">/</span>
                <span class="truncate max-w-[100px]">{props.selectedSubcategory}</span>
              </Show>
              <button
                id="menubar-clear-category-btn"
                type="button"
                class="ml-0.5 hover:text-white transition-colors cursor-pointer"
                onClick={props.onClearCategory}
                title="Clear category filter"
              >
                <X size={11} />
              </button>
            </div>
          </Show>

          {/* Channels Filter Segmented Control */}
          <SegmentedControl
            id="menubar-channels-control"
            value={props.channels}
            onChange={props.onSetChannels}
            items={[
              { id: '', label: 'All' },
              { id: '1', label: 'Mono' },
              { id: '2', label: 'Stereo' },
            ]}
            size="xs"
            class="h-7 min-h-[28px]"
          />

          {/* Max Duration Filter */}
          <div
            id="menubar-duration-filter"
            class="flex items-center h-7 min-h-[28px] px-2 rounded-[3px] bg-[#1e2022] border border-[#1c1d1f] text-md text-[#8b949e] gap-1 focus-within:border-[#007acc] shrink-0"
            title="Filter sounds shorter than or equal to max duration"
          >
            <Clock size={12} class="text-[#8b949e] shrink-0" />
            <span class="text-md font-medium uppercase tracking-wider text-[#8b949e]">Max</span>
            <input
              id="menubar-duration-input"
              type="number"
              class="w-10 bg-transparent text-md text-[#f0f3f6] font-mono focus:outline-none tabular-nums text-right"
              placeholder="∞"
              min="0"
              step="0.5"
              value={props.maxDuration}
              onInput={(e) => props.onChangeMaxDuration(e.currentTarget.value)}
            />
            <span class="text-md text-[#8b949e]">s</span>
            <Show when={props.maxDuration}>
              <button
                id="menubar-clear-duration-btn"
                type="button"
                class="w-3.5 h-3.5 flex items-center justify-center rounded text-[#8b949e] hover:text-[#f0f3f6] transition-colors cursor-pointer"
                onClick={() => props.onChangeMaxDuration('')}
                title="Clear duration filter"
              >
                <X size={10} />
              </button>
            </Show>
          </div>

          {/* Favorites Filter Button */}
          <Button
            id="menubar-favorites-btn"
            variant={props.favoritesOnly ? 'accent' : 'default'}
            size="xs"
            onClick={props.onToggleFavorites}
            icon={<Star size={11} class={props.favoritesOnly ? 'fill-current' : ''} />}
            title="Show favorites only"
          >
            <span>Favorites</span>
          </Button>

          {/* Clear Filters Button */}
          <IconButton
            id="menubar-clear-filters-btn"
            size="xs"
            active={props.hasActiveFilters}
            onClick={props.onClearFilters}
            disabled={!props.hasActiveFilters}
            tooltip={props.hasActiveFilters ? 'Clear all filters' : 'No active filters'}
          >
            <FilterX size={12} />
          </IconButton>

          {/* Autoplay Toggle Control */}
          <button
            id="menubar-autoplay-btn"
            type="button"
            onClick={props.onToggleAutoPlay}
            class="h-7 min-h-[28px] px-2 rounded-[3px] border text-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer select-none shrink-0"
            classList={{
              'bg-[#007acc]/20 border-[#007acc] text-[#f0f3f6] shadow-xs': props.autoPlay,
              'bg-[#1e2022] border-[#1c1d1f] text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]': !props.autoPlay
            }}
            title="Toggle auto-play when selecting a sound (Alt+A)"
          >
            <Zap
              size={12}
              class={props.autoPlay ? 'text-[#007acc]' : 'text-[#8b949e]'}
            />
            <span class="text-md">Auto-Play</span>
            <span
              id="menubar-autoplay-indicator"
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

        <Show when={!props.hasFolder}>
          <Button
            id="menubar-open-folder-btn"
            variant="primary"
            size="xs"
            onClick={props.onOpenFolder}
            icon={<FolderOpen size={12} />}
            title="Open Sound Folder (Ctrl+O)"
          >
            <span>Open Folder</span>
          </Button>
        </Show>
      </div>

      {/* Active Document / Library Breadcrumb */}
      <Show when={props.hasFolder && props.folderName}>
        <div id="menubar-library-breadcrumb" class="ml-auto pl-3 border-l border-[#1c1d1f] flex items-center gap-1.5 text-md font-mono text-[#8b949e] truncate max-w-xs shrink-0">
          <Folder size={13} class="text-[#007acc] shrink-0" />
          <span class="truncate">{props.folderName}</span>
        </div>
      </Show>
    </nav>
  );
}
