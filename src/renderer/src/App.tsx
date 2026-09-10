import { createSignal, createEffect, For, Show, onCleanup, onMount } from 'solid-js'
import type { SoundRow, RecentEntry, CategoryFacet, SearchParams, SortColumn, SortDir } from '../../preload/index'
import WaveformPreview, { WaveformApi } from './components/WaveformPreview'
import HelpModal from './components/HelpModal'
import SettingsModal from './components/SettingsModal'
import ExportModal, { ExportFile } from './components/ExportModal'
import CategoryModal from './components/CategoryModal'
import { CategorySidebar } from './components/CategorySidebar'
import appIcon from '../assets/app-icon.png'
import {
  FolderOpenIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
  FileAudioIcon,
  ClockIcon,
  LayersIcon,
  ActivityIcon,
  HardDriveIcon,
  GripVerticalIcon,
  Trash2Icon,
  DatabaseIcon,
  KeyboardIcon,
  HelpCircleIcon,
  SettingsIcon,
  ZapIcon,
  TagIcon,
  PanelLeftIcon,
  InfinityIcon,
  DownloadIcon,
  StarIcon,
  FolderIcon,
  TagPlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  FilterXIcon
} from './components/icons'

function formatDuration(d: number | null): string {
  if (d === null) return '-'
  return `${d.toFixed(2)}s`
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function SortArrow(props: { column: SortColumn; sortBy: SortColumn | undefined; sortDir: SortDir }) {
  if (props.sortBy !== props.column) {
    return <ChevronsUpDownIcon size={11} class="sort-arrow sort-arrow-idle" />
  }
  return props.sortDir === 'asc' ? (
    <ChevronUpIcon size={12} class="sort-arrow sort-arrow-active" />
  ) : (
    <ChevronDownIcon size={12} class="sort-arrow sort-arrow-active" />
  )
}

export default function App() {
  const [folder, setFolder] = createSignal<{ folder: string; count: number } | null>(null)
  const [recent, setRecent] = createSignal<RecentEntry[]>([])
  const [query, setQuery] = createSignal('')
  const [maxDuration, setMaxDuration] = createSignal<string>('')
  const [channels, setChannels] = createSignal<string>('')
  const [facets, setFacets] = createSignal<CategoryFacet[]>([])
  const [selectedCategory, setSelectedCategory] = createSignal<string>('')
  const [selectedSubcategory, setSelectedSubcategory] = createSignal<string>('')
  const [results, setResults] = createSignal<SoundRow[]>([])
  const [selected, setSelected] = createSignal(0)
  const [multiSelected, setMultiSelected] = createSignal<Set<number>>(new Set())
  const [reindexing, setReindexing] = createSignal(false)
  const [progress, setProgress] = createSignal<{ done: number; total: number } | null>(null)
  const [showHelp, setShowHelp] = createSignal(false)
  const [showSettings, setShowSettings] = createSignal(false)
  const [autoPlay, setAutoPlay] = createSignal(
    localStorage.getItem('slipsound:autoplay') !== 'false'
  )
  const [sidebarOpen, setSidebarOpen] = createSignal(
    localStorage.getItem('slipsound:sidebar') !== 'false'
  )
  const [infiniteScroll, setInfiniteScroll] = createSignal(
    localStorage.getItem('slipsound:infinitescroll') !== 'false'
  )
  const [matchingCount, setMatchingCount] = createSignal(0)
  const [loadingMore, setLoadingMore] = createSignal(false)
  const [exportModalOpen, setExportModalOpen] = createSignal(false)
  const [exportFiles, setExportFiles] = createSignal<ExportFile[]>([])
  const [categoryModalRows, setCategoryModalRows] = createSignal<SoundRow[]>([])
  const [favoritesOnly, setFavoritesOnly] = createSignal(false)
  const [sortBy, setSortBy] = createSignal<SortColumn | undefined>(undefined)
  const [sortDir, setSortDir] = createSignal<SortDir>('asc')

  // Numeric/favorite columns feel best starting high-to-low; text columns
  // feel best starting A-to-Z. Clicking the same column again just flips it.
  const DEFAULT_SORT_DIR: Record<SortColumn, SortDir> = {
    favorite: 'desc',
    filename: 'asc',
    category: 'asc',
    duration: 'desc',
    channels: 'desc',
    sample_rate: 'desc',
    filesize: 'desc'
  }

  function toggleSort(col: SortColumn): void {
    if (sortBy() === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir(DEFAULT_SORT_DIR[col])
    }
  }

  function toggleAutoPlay(): void {
    setAutoPlay((prev) => {
      const next = !prev
      localStorage.setItem('slipsound:autoplay', String(next))
      return next
    })
  }

  function toggleSidebar(): void {
    setSidebarOpen((prev) => {
      const next = !prev
      localStorage.setItem('slipsound:sidebar', String(next))
      return next
    })
  }

  function toggleInfiniteScroll(): void {
    setInfiniteScroll((prev) => {
      const next = !prev
      localStorage.setItem('slipsound:infinitescroll', String(next))
      return next
    })
  }

  let waveApi: WaveformApi | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let listContainer: HTMLDivElement | undefined
  let searchInput: HTMLInputElement | undefined

  onMount(async () => {
    let current = await window.api.getCurrentFolder()
    if (!current) {
      // Nothing open yet this session — pick up where the user left off.
      current = await window.api.openLastFolder()
    }
    if (current) {
      setFolder(current)
      await refreshFacets()
      runSearch()
    }
    setRecent(await window.api.getRecentFolders())

    onCleanup(
      window.api.onReindexStart(() => {
        setReindexing(true)
        setProgress(null)
      })
    )
    onCleanup(
      window.api.onReindexProgress((done, total) => {
        setProgress({ done, total })
      })
    )
    onCleanup(
      window.api.onReindexEnd(() => {
        setReindexing(false)
        setProgress(null)
        refreshCurrentCount()
        refreshFacets()
        runSearch()
      })
    )

    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  async function refreshRecent(): Promise<void> {
    setRecent(await window.api.getRecentFolders())
  }

  async function refreshCurrentCount(): Promise<void> {
    const current = await window.api.getCurrentFolder()
    if (current) setFolder(current)
  }

  async function refreshFacets(): Promise<void> {
    setFacets(await window.api.getCategoryFacets())
  }

  async function pickFolder(): Promise<void> {
    const res = await window.api.pickAndOpenFolder()
    if (res) {
      setFolder(res)
      await refreshRecent()
      await refreshFacets()
      runSearch()
    }
  }

  async function openRecent(f: string): Promise<void> {
    const res = await window.api.openFolder(f)
    setFolder(res)
    await refreshRecent()
    await refreshFacets()
    runSearch()
  }

  async function removeRecent(f: string, e: MouseEvent): Promise<void> {
    e.stopPropagation()
    setRecent(await window.api.removeRecentFolder(f))
  }

  async function doReindex(): Promise<void> {
    if (!folder()) return
    await window.api.reindex()
  }

  const currentSearchParams = (): SearchParams => ({
    query: query(),
    maxDuration: maxDuration() ? parseFloat(maxDuration()) : undefined,
    channels: channels() ? parseInt(channels(), 10) : undefined,
    category: selectedCategory() || undefined,
    subcategory: selectedSubcategory() || undefined,
    favoriteOnly: favoritesOnly() || undefined,
    sortBy: sortBy(),
    sortDir: sortDir()
  })

  let searchSeq = 0

  async function runSearch(): Promise<void> {
    if (!folder()) {
      setResults([])
      setMatchingCount(0)
      return
    }
    const seq = ++searchSeq
    const params = currentSearchParams()
    const [total, rows] = await Promise.all([
      window.api.count(params),
      window.api.search({ ...params, limit: 100, offset: 0 })
    ])
    if (seq !== searchSeq) return
    setMatchingCount(total)
    setResults(rows)
    setSelected(0)
    setMultiSelected(new Set<number>())
    selectAnchor = 0
  }

  async function loadMore(): Promise<void> {
    if (loadingMore() || !folder() || results().length >= matchingCount()) return
    setLoadingMore(true)
    try {
      const nextRows = await window.api.search({
        ...currentSearchParams(),
        limit: 100,
        offset: results().length
      })
      if (nextRows.length > 0) {
        setResults((prev) => [...prev, ...nextRows])
      }
    } finally {
      setLoadingMore(false)
    }
  }

  function onListScroll(e: Event): void {
    if (!infiniteScroll()) return
    const target = e.currentTarget as HTMLDivElement
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 350) {
      loadMore()
    }
  }

  function clearFilters(): void {
    setQuery('')
    setMaxDuration('')
    setChannels('')
    setSelectedCategory('')
    setSelectedSubcategory('')
    setFavoritesOnly(false)
  }

  const hasActiveFilters = (): boolean => {
    return (
      query() !== '' ||
      maxDuration() !== '' ||
      channels() !== '' ||
      selectedCategory() !== '' ||
      favoritesOnly()
    )
  }

  async function toggleRowFavorite(row: SoundRow, e: MouseEvent): Promise<void> {
    e.stopPropagation()
    const next = await window.api.toggleFavorite(row.path)
    setResults((prev) => prev.map((r) => (r.path === row.path ? { ...r, favorite: next } : r)))
    if (favoritesOnly() && !next) {
      // Dropped out of the active "favorites only" filter — drop it from view too.
      setResults((prev) => prev.filter((r) => r.path !== row.path))
      setMatchingCount((c) => Math.max(0, c - 1))
    }
  }

  function revealRow(row: SoundRow, e: MouseEvent): void {
    e.stopPropagation()
    window.api.revealInFolder(row.path)
  }

  function clickCategory(category: string): void {
    if (selectedCategory() === category) {
      setSelectedCategory('')
      setSelectedSubcategory('')
    } else {
      setSelectedCategory(category)
      setSelectedSubcategory('')
    }
  }

  function clickSubcategory(subcategory: string): void {
    setSelectedSubcategory((prev) => (prev === subcategory ? '' : subcategory))
  }

  let selectAnchor = 0

  function toggleMultiSelect(i: number): void {
    setMultiSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function selectRange(from: number, to: number): void {
    const next = new Set<number>()
    const [lo, hi] = from <= to ? [from, to] : [to, from]
    for (let idx = lo; idx <= hi; idx++) next.add(idx)
    setMultiSelected(next)
  }

  function onRowClick(i: number, e: MouseEvent): void {
    if (e.shiftKey) {
      selectRange(selectAnchor, i)
      setSelected(i)
      if (autoPlay()) waveApi?.play()
      return
    }
    if (e.ctrlKey || e.metaKey) {
      toggleMultiSelect(i)
      selectAnchor = i
      return
    }
    setMultiSelected(new Set<number>())
    setSelected(i)
    selectAnchor = i
    if (autoPlay()) waveApi?.play()
  }

  function onRowDblClick(i: number, _e: MouseEvent): void {
    setMultiSelected(new Set<number>())
    setSelected(i)
    selectAnchor = i
    requestAnimationFrame(() => {
      waveApi?.play()
    })
  }

  function onRowDragStart(i: number, e: DragEvent): void {
    e.preventDefault()
    const multi = multiSelected()
    const indices = multi.has(i) && multi.size > 0 ? [...multi] : [i]
    const paths = indices.map((idx) => results()[idx]?.path).filter((p): p is string => !!p)
    if (paths.length > 0) window.api.startDrag(paths)
  }

  function openExportForSelection(): void {
    const rows = [...multiSelected()]
      .sort((a, b) => a - b)
      .map((idx) => results()[idx])
      .filter((r): r is SoundRow => !!r)
    if (rows.length === 0) return
    setExportFiles(rows.map((r) => ({ sourcePath: r.path, filename: r.filename })))
    setExportModalOpen(true)
  }

  function openExportForRow(row: SoundRow, region: { start: number; end: number } | null): void {
    setExportFiles([{ sourcePath: row.path, filename: row.filename, start: region?.start, end: region?.end }])
    setExportModalOpen(true)
  }

  function openCategoryModalForRow(row: SoundRow): void {
    setCategoryModalRows([row])
  }

  function openCategoryModalForSelection(): void {
    const rows = [...multiSelected()]
      .sort((a, b) => a - b)
      .map((idx) => results()[idx])
      .filter((r): r is SoundRow => !!r)
    if (rows.length === 0) return
    setCategoryModalRows(rows)
  }

  async function applyCategory(category: string, subcategory: string | null): Promise<void> {
    const rows = categoryModalRows()
    if (rows.length === 0) return
    const paths = new Set(rows.map((r) => r.path))
    await Promise.all(rows.map((r) => window.api.setCategory(r.path, category, subcategory)))
    setResults((prev) =>
      prev.map((r) => (paths.has(r.path) ? { ...r, category, subcategory, confidence: 1, category_manual: true } : r))
    )
    setCategoryModalRows([])
    await refreshFacets()
  }

  async function removeCategory(): Promise<void> {
    const rows = categoryModalRows()
    if (rows.length === 0) return
    const paths = new Set(rows.map((r) => r.path))
    await Promise.all(rows.map((r) => window.api.clearCategory(r.path)))
    setResults((prev) =>
      prev.map((r) =>
        paths.has(r.path)
          ? { ...r, category: 'Uncategorized', subcategory: null, confidence: 0, matched_terms: [], category_manual: false }
          : r
      )
    )
    setCategoryModalRows([])
    await refreshFacets()
  }

  createEffect(() => {
    query()
    maxDuration()
    channels()
    selectedCategory()
    selectedSubcategory()
    favoritesOnly()
    sortBy()
    sortDir()
    folder()
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => runSearch(), 200)
  })

  function onKeyDown(e: KeyboardEvent): void {
    const active = document.activeElement
    const isInput = active?.tagName === 'INPUT' || active?.tagName === 'SELECT'

    // Toggle Help guide with '?' or 'F1'
    if ((e.key === '?' || e.key === 'F1') && !isInput) {
      e.preventDefault()
      setShowHelp((prev) => !prev)
      return
    }

    // Toggle Auto-play on select with 'Alt+A'
    if (e.altKey && e.key.toLowerCase() === 'a' && !isInput) {
      e.preventDefault()
      toggleAutoPlay()
      return
    }

    // If export, category, or settings modal is active, suppress global navigation keys
    if (exportModalOpen() || categoryModalRows().length > 0 || showSettings()) {
      return
    }

    // Close Help guide with 'Escape'
    if (e.key === 'Escape' && showHelp()) {
      e.preventDefault()
      setShowHelp(false)
      return
    }

    // Global shortcut Ctrl+E / Cmd+E to open export dialog
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      if (multiSelected().size > 0) {
        openExportForSelection()
      } else if (selectedRow()) {
        openExportForRow(selectedRow()!, null)
      }
      return
    }

    // Global shortcut Ctrl+O / Cmd+O to open folder
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault()
      pickFolder()
      return
    }

    // Global shortcut Ctrl+B / Cmd+B to toggle categories sidebar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      toggleSidebar()
      return
    }

    // Global shortcut Ctrl+F / Cmd+F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      searchInput?.focus()
      searchInput?.select()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results().length - 1))
      scrollSelectedIntoView()
      if (autoPlay()) waveApi?.play()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
      scrollSelectedIntoView()
      if (autoPlay()) waveApi?.play()
    } else if (e.key === 'Home' && !isInput) {
      e.preventDefault()
      setSelected(0)
      scrollSelectedIntoView()
      if (autoPlay()) waveApi?.play()
    } else if (e.key === 'End' && !isInput) {
      e.preventDefault()
      setSelected(Math.max(0, results().length - 1))
      scrollSelectedIntoView()
      if (autoPlay()) waveApi?.play()
    } else if (e.code === 'Space' && !isInput) {
      e.preventDefault()
      waveApi?.togglePlay()
    }
  }

  function scrollSelectedIntoView(): void {
    requestAnimationFrame(() => {
      const el = listContainer?.querySelector(`[data-idx="${selected()}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  const progressPct = (): number => {
    const p = progress()
    if (!p || p.total === 0) return 0
    return Math.round((p.done / p.total) * 100)
  }

  const selectedRow = (): SoundRow | null => {
    return results()[selected()] ?? null
  }

  const multiSelectTotalSize = (): number => {
    let sum = 0
    for (const idx of multiSelected()) {
      sum += results()[idx]?.filesize ?? 0
    }
    return sum
  }

  return (
    <div class="app-container">
      {/* Top Main Toolbar */}
      <header class="top-toolbar">
        <div class="toolbar-left">
          <div class="brand-badge">
            <img src={appIcon} alt="SlipSound" class="brand-icon-img" />
          </div>

          <button class="btn-flat btn-primary" onClick={pickFolder} title="Open Sound Folder (Ctrl+O)">
            <FolderOpenIcon size={14} />
            <span>Open Folder</span>
          </button>

          <button
            class="btn-flat"
            onClick={doReindex}
            disabled={!folder() || reindexing()}
            title="Scan folder for new or modified sounds"
          >
            <RefreshCwIcon size={14} class={reindexing() ? 'animate-spin text-amber-400' : ''} />
            <span>{reindexing() ? 'Indexing…' : 'Reindex'}</span>
          </button>

          <Show when={folder()}>
            <button
              class="btn-flat btn-ghost"
              onClick={() => setFolder(null)}
              title="Close Library & View Recents"
            >
              <XIcon size={14} />
              <span>Close Library</span>
            </button>
          </Show>
        </div>

        <div class="toolbar-right">
          <button
            class="btn-flat btn-ghost btn-icon-only"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <SettingsIcon size={15} />
          </button>
          <button class="btn-flat btn-ghost" onClick={() => setShowHelp(true)} title="Quick Guide & Hotkeys (?)">
            <HelpCircleIcon size={15} class="text-blue-400" />
            <span>Help</span>
          </button>
        </div>
      </header>

      {/* Flat Reindex Progress Bar */}
      <Show when={reindexing()}>
        <div class="reindex-line-track">
          <div class="reindex-line-fill" style={{ width: `${progressPct()}%` }} />
        </div>
      </Show>

      {/* Welcome View when no folder is selected */}
      <Show when={!folder()}>
        <div class="welcome-container">
          <div class="welcome-card">
            <div class="welcome-logo">
              <img src={appIcon} alt="" class="welcome-logo-img" />
            </div>

            <div>
              <h1 class="welcome-title">SlipSound Audio Library</h1>
              <p class="welcome-subtitle">
                A clean, dead simple desktop audio organizer and waveform region exporter for sound designers and producers.
              </p>
            </div>

            <button
              class="btn-flat btn-primary"
              style={{ padding: '0 18px', height: '34px', 'font-size': '13px' }}
              onClick={pickFolder}
            >
              <FolderOpenIcon size={16} />
              <span>Choose Sound Folder</span>
            </button>

            {/* Recent Databases List */}
            <Show when={recent().length > 0}>
              <div class="recent-databases-card">
                <div class="recent-header">
                  <DatabaseIcon size={12} />
                  <span>Recent Databases</span>
                </div>
                <For each={recent()}>
                  {(entry) => (
                    <div class="recent-item-row" onClick={() => openRecent(entry.folder)}>
                      <div class="recent-folder-info" title={entry.folder}>
                        <FileAudioIcon size={14} class="text-zinc-500 flex-shrink-0" />
                        <span class="truncate">{entry.folder}</span>
                      </div>
                      <button
                        class="recent-remove-btn"
                        title="Remove from recents"
                        onClick={(e) => removeRecent(entry.folder, e)}
                      >
                        <Trash2Icon size={12} />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Keyboard Shortcuts Guide */}
            <div class="shortcuts-card">
              <div class="shortcut-item">
                <span>Play / Pause</span>
                <span class="shortcut-key">Space</span>
              </div>
              <div class="shortcut-item">
                <span>Navigate Sounds</span>
                <span class="shortcut-key">↑ / ↓</span>
              </div>
              <div class="shortcut-item">
                <span>Multi-Select</span>
                <span class="shortcut-key">Ctrl + Click</span>
              </div>
              <div class="shortcut-item">
                <span>Drag to DAW</span>
                <span class="shortcut-key">Drag Row</span>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Main Sound Browser View */}
      <Show when={folder()}>
        {/* Spacious Search & Filter Area */}
        <div class="search-area">
          <div class="search-primary-row">
            {/* Sidebar Toggle Button */}
            <button
              type="button"
              class="btn-flat btn-sidebar-toggle"
              classList={{
                'sidebar-open': sidebarOpen(),
                'has-category-filter': Boolean(selectedCategory())
              }}
              onClick={toggleSidebar}
              title="Toggle Categories Sidebar (Ctrl+B)"
            >
              <PanelLeftIcon size={14} />
              <span>Categories</span>
              <Show when={selectedCategory()}>
                <span class="active-dot" />
              </Show>
            </button>

            <div class="search-input-wrapper">
              <SearchIcon size={16} class="search-input-icon" />
              <input
                ref={searchInput}
                type="text"
                class="search-input"
                placeholder="Search sounds by filename… (Ctrl+F to focus)"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                autofocus
              />
              <Show when={query().length > 0} fallback={<div class="search-kbd-hint"><kbd>Ctrl+F</kbd></div>}>
                <button class="search-clear-btn" onClick={() => setQuery('')} title="Clear search">
                  <XIcon size={14} />
                </button>
              </Show>
            </div>

            {/* Active Category Filter Chip */}
            <Show when={selectedCategory()}>
              <div class="active-category-chip" title="Active Category Filter">
                <TagIcon size={12} class="chip-tag-icon" />
                <span class="chip-label">{selectedCategory()}</span>
                <Show when={selectedSubcategory()}>
                  <span class="chip-divider">/</span>
                  <span class="chip-sublabel">{selectedSubcategory()}</span>
                </Show>
                <button
                  type="button"
                  class="chip-clear-btn"
                  onClick={() => {
                    setSelectedCategory('')
                    setSelectedSubcategory('')
                  }}
                  title="Clear category filter"
                >
                  <XIcon size={11} />
                </button>
              </div>
            </Show>

            {/* Segmented Channels Button Group */}
            <div class="segmented-control" title="Filter audio channels">
              <span class="segmented-label">
                <LayersIcon size={14} />
              </span>
              <button
                type="button"
                class="segmented-btn"
                classList={{ active: channels() === '' }}
                onClick={() => setChannels('')}
              >
                All
              </button>
              <button
                type="button"
                class="segmented-btn"
                classList={{ active: channels() === '1' }}
                onClick={() => setChannels('1')}
              >
                Mono
              </button>
              <button
                type="button"
                class="segmented-btn"
                classList={{ active: channels() === '2' }}
                onClick={() => setChannels('2')}
              >
                Stereo
              </button>
            </div>

            {/* Max Duration Pill */}
            <div class="filter-pill-input" title="Filter sounds shorter than or equal to max duration">
              <ClockIcon size={14} class="filter-pill-icon" />
              <span class="filter-pill-label">Max</span>
              <input
                type="number"
                class="filter-pill-field tabular"
                placeholder="∞"
                min="0"
                step="0.5"
                value={maxDuration()}
                onInput={(e) => setMaxDuration(e.currentTarget.value)}
              />
              <span class="filter-pill-unit">s</span>
              <Show when={maxDuration()}>
                <button class="filter-pill-clear" onClick={() => setMaxDuration('')} title="Clear duration filter">
                  <XIcon size={12} />
                </button>
              </Show>
            </div>

            {/* Favorites Only Filter Toggle */}
            <button
              type="button"
              class="btn-flat favorites-filter-btn"
              classList={{ active: favoritesOnly() }}
              onClick={() => setFavoritesOnly((v) => !v)}
              title="Show favorites only"
            >
              <StarIcon size={14} filled={favoritesOnly()} />
              <span>Favorites</span>
            </button>

            {/* Reset Filters Action */}
            <button
              type="button"
              class="btn-flat btn-ghost btn-icon-only"
              classList={{ 'has-active-filters': hasActiveFilters() }}
              onClick={clearFilters}
              disabled={!hasActiveFilters()}
              title={hasActiveFilters() ? 'Clear all filters' : 'No active filters'}
            >
              <FilterXIcon size={15} />
            </button>
          </div>
        </div>

        {/* Main Split Layout: Categories Sidebar + Results Table */}
        <div class="browser-split-layout">
          <CategorySidebar
            facets={facets()}
            selectedCategory={selectedCategory()}
            selectedSubcategory={selectedSubcategory()}
            totalSounds={folder()?.count ?? 0}
            isOpen={sidebarOpen()}
            onSelectCategory={clickCategory}
            onSelectSubcategory={clickSubcategory}
            onClear={() => {
              setSelectedCategory('')
              setSelectedSubcategory('')
            }}
            onClose={() => setSidebarOpen(false)}
          />

          <div class="browser-table-pane">
            {/* Multi-Select Floating Notification */}
            <Show when={multiSelected().size > 0}>
              <div class="multi-select-banner">
                <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                  <GripVerticalIcon size={14} />
                  <span>
                    {multiSelected().size} sounds selected ({formatSize(multiSelectTotalSize())}) — Drag out to copy into DAW or folder
                  </span>
                </div>
                <div class="multi-select-actions">
                  <button class="btn-flat btn-primary" onClick={openExportForSelection}>
                    <DownloadIcon size={13} />
                    <span>Export Selected…</span>
                  </button>
                  <button class="btn-flat btn-primary" onClick={openCategoryModalForSelection}>
                    <TagPlusIcon size={13} />
                    <span>Set Category…</span>
                  </button>
                  <button class="btn-flat btn-ghost" onClick={() => setMultiSelected(new Set())}>
                    Clear selection
                  </button>
                </div>
              </div>
            </Show>

            {/* Sound Results Table Header */}
            <div class="table-header">
              <div
                class="table-header-col col-center sortable-header"
                classList={{ 'sort-active': sortBy() === 'favorite' }}
                onClick={() => toggleSort('favorite')}
                title="Sort by favorite"
              >
                <StarIcon size={12} />
                <SortArrow column="favorite" sortBy={sortBy()} sortDir={sortDir()} />
              </div>
              <div
                class="table-header-col col-left col-name sortable-header"
                classList={{ 'sort-active': sortBy() === 'filename' }}
                onClick={() => toggleSort('filename')}
                title="Sort by name"
              >
                <FileAudioIcon size={13} />
                <span>Sound Name</span>
                <SortArrow column="filename" sortBy={sortBy()} sortDir={sortDir()} />
              </div>
              <div
                class="table-header-col col-left col-cat sortable-header"
                classList={{ 'sort-active': sortBy() === 'category' }}
                onClick={() => toggleSort('category')}
                title="Sort by category"
              >
                <TagIcon size={13} />
                <span>Category</span>
                <SortArrow column="category" sortBy={sortBy()} sortDir={sortDir()} />
              </div>
              <div
                class="table-header-col col-right col-duration sortable-header"
                classList={{ 'sort-active': sortBy() === 'duration' }}
                onClick={() => toggleSort('duration')}
                title="Sort by duration"
              >
                <ClockIcon size={13} />
                <span>Duration</span>
                <SortArrow column="duration" sortBy={sortBy()} sortDir={sortDir()} />
              </div>
              <div
                class="table-header-col col-left col-channels sortable-header"
                classList={{ 'sort-active': sortBy() === 'channels' }}
                onClick={() => toggleSort('channels')}
                title="Sort by channels"
              >
                <LayersIcon size={13} />
                <span>Channels</span>
                <SortArrow column="channels" sortBy={sortBy()} sortDir={sortDir()} />
              </div>
              <div
                class="table-header-col col-right col-samplerate sortable-header"
                classList={{ 'sort-active': sortBy() === 'sample_rate' }}
                onClick={() => toggleSort('sample_rate')}
                title="Sort by sample rate"
              >
                <ActivityIcon size={13} />
                <span>Sample Rate</span>
                <SortArrow column="sample_rate" sortBy={sortBy()} sortDir={sortDir()} />
              </div>
              <div
                class="table-header-col col-right col-size sortable-header"
                classList={{ 'sort-active': sortBy() === 'filesize' }}
                onClick={() => toggleSort('filesize')}
                title="Sort by size"
              >
                <HardDriveIcon size={13} />
                <span>Size</span>
                <SortArrow column="filesize" sortBy={sortBy()} sortDir={sortDir()} />
              </div>
              <div class="table-header-col col-center col-handle">
                <DownloadIcon size={13} />
              </div>
            </div>

            {/* Sound Results Rows with Infinite Scroll */}
            <div class="results-container" ref={listContainer} onScroll={onListScroll}>
              <For
                each={results()}
                fallback={
                  <div
                    style={{
                      display: 'flex',
                      'flex-direction': 'column',
                      'align-items': 'center',
                      'justify-content': 'center',
                      padding: '48px',
                      color: 'var(--text-muted)',
                      gap: '8px'
                    }}
                  >
                    <SearchIcon size={24} style={{ opacity: 0.3 }} />
                    <span>No sounds match the current filter</span>
                  </div>
                }
              >
                {(row, i) => (
                  <div
                    class="sound-row"
                    classList={{
                      selected: i() === selected(),
                      'multi-selected': multiSelected().has(i())
                    }}
                    data-idx={i()}
                    draggable={true}
                    onClick={(e) => onRowClick(i(), e)}
                    onDblClick={(e) => onRowDblClick(i(), e)}
                    onDragStart={(e) => onRowDragStart(i(), e)}
                    title={row.path}
                  >
                    <div class="col-center">
                      <button
                        type="button"
                        class="favorite-star-btn"
                        classList={{ 'is-favorite': row.favorite }}
                        onClick={(e) => toggleRowFavorite(row, e)}
                        title={row.favorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <StarIcon size={14} filled={row.favorite} />
                      </button>
                    </div>
                    <div class="sound-title-col col-left col-name">
                      <FileAudioIcon size={14} class="sound-icon" />
                      <span class="sound-name">{row.filename}</span>
                    </div>

                    <div
                      class="col-category col-left col-cat category-cell-editable"
                      onClick={(e) => {
                        e.stopPropagation()
                        openCategoryModalForRow(row)
                      }}
                      title="Click to set category"
                    >
                      <Show
                        when={row.category && row.category !== 'Uncategorized'}
                        fallback={
                          <span class="category-empty-dash">
                            <TagPlusIcon size={13} />
                          </span>
                        }
                      >
                        <span
                          class="category-badge"
                          classList={{ 'low-confidence': row.confidence < 0.4, manual: row.category_manual }}
                          title={`${row.category}${row.subcategory ? ' > ' + row.subcategory : ''}${row.category_manual ? ' (manually set)' : ` (confidence ${(row.confidence * 100).toFixed(0)}%)`}`}
                        >
                          {row.subcategory ? `${row.category} / ${row.subcategory}` : row.category}
                        </span>
                      </Show>
                    </div>

                    <div class="col-num col-right col-duration">{formatDuration(row.duration)}</div>
                    <div class="col-num col-left col-channels" style={{ 'text-transform': 'lowercase' }}>
                      {row.channels === 1 ? 'mono' : row.channels === 2 ? 'stereo' : row.channels ? `${row.channels}ch` : '-'}
                    </div>
                    <div class="col-num col-right col-samplerate">
                      {row.sample_rate ? `${row.sample_rate} Hz` : '-'}
                    </div>
                    <div class="col-num col-right col-size">{formatSize(row.filesize)}</div>
                    <div class="row-actions-col col-center col-handle">
                      <button
                        type="button"
                        class="reveal-folder-btn"
                        onClick={(e) => revealRow(row, e)}
                        title="Reveal in file manager"
                      >
                        <FolderIcon size={14} />
                      </button>
                      <button
                        type="button"
                        class="row-export-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          openExportForRow(row, null)
                        }}
                        title="Export this sound"
                      >
                        <DownloadIcon size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </For>

              {/* Infinite Scroll Footer */}
              <Show when={results().length > 0}>
                <div class="results-load-footer">
                  <Show when={loadingMore()}>
                    <div class="loading-more-indicator">
                      <RefreshCwIcon size={14} class="spin" />
                      <span>Loading more sounds…</span>
                    </div>
                  </Show>
                  <Show when={!loadingMore() && results().length < matchingCount() && !infiniteScroll()}>
                    <button type="button" class="btn-flat btn-load-more" onClick={loadMore}>
                      <span>Load Next 100 Sounds ({results().length} of {matchingCount()} loaded)</span>
                    </button>
                  </Show>
                  <Show when={!loadingMore() && results().length >= matchingCount() && matchingCount() > 50}>
                    <span class="all-loaded-text">All {matchingCount()} sounds loaded</span>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </div>

        {/* Waveform Bottom Dock Panel */}
        <WaveformPreview
          row={selectedRow()}
          onApi={(api) => (waveApi = api)}
          onExportRequest={(region) => {
            const row = selectedRow()
            if (row) openExportForRow(row, region)
          }}
        />
      </Show>

      {/* VSCode-style Flat Bottom Status Bar */}
      <footer class="status-bar">
        <div class="status-bar-left">
          <Show
            when={folder()}
            fallback={
              <div class="status-item">
                <DatabaseIcon size={11} />
                <span>Ready</span>
              </div>
            }
          >
            <div class="status-item status-item-library" title={folder()!.folder}>
              <DatabaseIcon size={11} />
              <span class="status-library-path">
                {folder()!.folder.split(/[/\\]/).pop() || folder()!.folder}
              </span>
            </div>

            <div class="status-item">
              <span>{folder()!.count} Total Sounds</span>
            </div>

            <div class="status-item tabular" title={`${results().length} loaded of ${matchingCount()} matching sounds`}>
              <span>
                {results().length === matchingCount()
                  ? `${matchingCount()} shown`
                  : `${results().length} / ${matchingCount()} shown`}
              </span>
            </div>

            <Show when={matchingCount() !== folder()!.count}>
              <div class="status-item accent">
                <span>Filtered</span>
              </div>
            </Show>

            <Show when={multiSelected().size > 0}>
              <div class="status-item accent-blue tabular">
                <span>{multiSelected().size} selected</span>
              </div>
            </Show>
          </Show>
        </div>

        <div class="status-bar-right">
          <button
            class="auto-play-status-pill tabular"
            classList={{ active: infiniteScroll() }}
            onClick={toggleInfiniteScroll}
            title={`Toggle Infinite Scroll. Currently: ${infiniteScroll() ? 'ON' : 'OFF'}`}
          >
            <InfinityIcon size={12} class={infiniteScroll() ? 'text-blue-400' : 'text-zinc-500'} />
            <span>Infinite Scroll: {infiniteScroll() ? 'ON' : 'OFF'}</span>
          </button>

          <button
            class="auto-play-status-pill tabular"
            classList={{ active: autoPlay() }}
            onClick={toggleAutoPlay}
            title={`Toggle Auto-play on select (Alt+A). Currently: ${autoPlay() ? 'ON' : 'OFF'}`}
          >
            <ZapIcon size={12} class={autoPlay() ? 'text-amber-400' : 'text-zinc-500'} />
            <span>Auto-play: {autoPlay() ? 'ON' : 'OFF'}</span>
          </button>

          <Show when={selectedRow()}>
            <div class="status-item tabular">
              <span>
                {selectedRow()!.channels === 1
                  ? 'Mono'
                  : selectedRow()!.channels === 2
                  ? 'Stereo'
                  : ''}{' '}
                {selectedRow()!.sample_rate ? `• ${selectedRow()!.sample_rate} Hz` : ''}{' '}
                {selectedRow()!.filesize ? `• ${formatSize(selectedRow()!.filesize)}` : ''}
              </span>
            </div>
          </Show>

          <div
            class="status-item"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowHelp(true)}
            title="Open Hotkeys & Quick Guide (?)"
          >
            <KeyboardIcon size={12} />
            <span>Shortcuts & Guide (?)</span>
          </div>
        </div>
      </footer>

      {/* Help Modal Guide */}
      <HelpModal isOpen={showHelp()} onClose={() => setShowHelp(false)} />

      {/* Settings Modal (MCP toggle + connection info) */}
      <SettingsModal isOpen={showSettings()} onClose={() => setShowSettings(false)} />

      {/* Shared Export Wizard Modal */}
      <ExportModal open={exportModalOpen()} files={exportFiles()} onClose={() => setExportModalOpen(false)} />

      {/* Category Assignment Modal */}
      <CategoryModal
        rows={categoryModalRows()}
        facets={facets()}
        onSave={applyCategory}
        onRemove={removeCategory}
        onClose={() => setCategoryModalRows([])}
      />

      {/* Indexing Modal Spinner */}
      <Show when={reindexing()}>
        <div class="spinner-backdrop">
          <div class="spinner-card">
            <div class="spinner-ring" />
            <div class="spinner-title">Scanning Sound Library…</div>
            <div class="spinner-progress-text">
              {progress() ? `${progress()!.done} of ${progress()!.total} files processed` : 'Scanning directory…'}
            </div>
            <div class="reindex-line-track" style={{ width: '180px' }}>
              <div class="reindex-line-fill" style={{ width: `${progressPct()}%` }} />
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
