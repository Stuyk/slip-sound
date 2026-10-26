import { createSignal, createEffect, Show, onCleanup, onMount } from 'solid-js'
import type { SoundRow, RecentEntry, CategoryFacet, SearchParams, SortColumn, SortDir } from '../../preload/index'
import WaveformPreview, { WaveformApi } from './components/WaveformPreview'
import HelpModal from './components/HelpModal'
import SettingsModal from './components/SettingsModal'
import ExportModal, { ExportFile } from './components/ExportModal'
import CategoryModal from './components/CategoryModal'
import SlicerModal from './components/SlicerModal'
import SeamlessLoopModal from './components/SeamlessLoopModal'
import { CategorySidebar } from './components/CategorySidebar'
import { fetchAllMatchingSounds } from './selection'
import { ThemeProvider } from './themes/context'
import { WorkstationMenuBar } from './components/workstation/WorkstationMenuBar'
import { SoundTable } from './components/workstation/SoundTable'
import { WorkstationStatusBar } from './components/workstation/WorkstationStatusBar'
import { WelcomeScreen } from './components/workstation/WelcomeScreen'
import { ScanningOverlay } from './components/workstation/ScanningOverlay'
import { ToastContainer } from './components/ui/Toast'
import appIcon from '../assets/app-icon.png'

function formatDuration(d?: number | null): string {
  if (d === null || d === undefined) return '-'
  return `${d.toFixed(2)}s`
}

function formatSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function MainWorkstation() {
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
  const [multiSelected, setMultiSelected] = createSignal<Map<string, SoundRow>>(new Map())
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
  const [slicerRow, setSlicerRow] = createSignal<SoundRow | null>(null)
  const [slicerSeed, setSlicerSeed] = createSignal<{ start: number; end: number } | null>(null)
  const [loopRow, setLoopRow] = createSignal<SoundRow | null>(null)
  const [loopSeed, setLoopSeed] = createSignal<{ start: number; end: number } | null>(null)
  const [categoryModalRows, setCategoryModalRows] = createSignal<SoundRow[]>([])
  const [favoritesOnly, setFavoritesOnly] = createSignal(false)
  const [sortBy, setSortBy] = createSignal<SortColumn>(
    (localStorage.getItem('slipsound:sortby') as SortColumn) || 'filename'
  )
  const [sortDir, setSortDir] = createSignal<SortDir>(
    (localStorage.getItem('slipsound:sortdir') as SortDir) || 'asc'
  )

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
      const nextDir = sortDir() === 'asc' ? 'desc' : 'asc'
      setSortDir(nextDir)
      try {
        localStorage.setItem('slipsound:sortdir', nextDir)
      } catch {
        // ignore
      }
    } else {
      setSortBy(col)
      const nextDir = DEFAULT_SORT_DIR[col]
      setSortDir(nextDir)
      try {
        localStorage.setItem('slipsound:sortby', col)
        localStorage.setItem('slipsound:sortdir', nextDir)
      } catch {
        // ignore
      }
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
  let selectAllSeq = 0

  async function runSearch(): Promise<void> {
    selectAllSeq++
    if (!folder()) {
      setResults([])
      setMatchingCount(0)
      return
    }
    const seq = ++searchSeq
    const params = currentSearchParams()

    const [matching, firstPage] = await Promise.all([
      window.api.count(params),
      window.api.search({ ...params, limit: 100, offset: 0 })
    ])
    if (seq !== searchSeq) return

    setMatchingCount(matching)
    setResults(firstPage)
    setSelected(0)
    setMultiSelected(new Map())
  }

  async function loadMore(): Promise<void> {
    if (loadingMore() || !folder()) return
    const currentResults = results()
    if (currentResults.length >= matchingCount()) return

    setLoadingMore(true)
    try {
      const nextRows = await window.api.search({
        ...currentSearchParams(),
        limit: 100,
        offset: currentResults.length
      })
      setResults((prev) => [...prev, ...nextRows])
    } finally {
      setLoadingMore(false)
    }
  }

  function onListScroll(e: Event): void {
    if (!infiniteScroll()) return
    const el = e.currentTarget as HTMLElement
    const threshold = 200
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      if (!loadingMore() && results().length < matchingCount()) {
        loadMore()
      }
    }
  }

  function onRowClick(index: number, e: MouseEvent): void {
    const row = results()[index]
    if (!row) return

    if (e.shiftKey) {
      const activeIdx = selected()
      const start = Math.min(activeIdx, index)
      const end = Math.max(activeIdx, index)
      const newMap = new Map(multiSelected())
      for (let i = start; i <= end; i++) {
        const r = results()[i]
        if (r) newMap.set(r.path, r)
      }
      setMultiSelected(newMap)
      setSelected(index)
      return
    }

    if (e.ctrlKey || e.metaKey) {
      setMultiSelected((prev) => {
        const next = new Map(prev)
        if (next.has(row.path)) {
          next.delete(row.path)
        } else {
          next.set(row.path, row)
        }
        return next
      })
      setSelected(index)
      return
    }

    setMultiSelected(new Map())
    setSelected(index)
    if (autoPlay()) {
      waveApi?.play()
    }
  }

  function onRowDblClick(index: number, e: MouseEvent): void {
    e.stopPropagation()
    setSelected(index)
    waveApi?.play()
  }

  function onRowDragStart(index: number, e: DragEvent): void {
    const row = results()[index]
    if (!row) return
    const selectedPaths = multiSelected().has(row.path)
      ? Array.from(multiSelected().keys())
      : [row.path]
    window.api.startDrag(selectedPaths)
    e.preventDefault()
  }

  async function toggleRowFavorite(row: SoundRow, e: MouseEvent): Promise<void> {
    e.stopPropagation()
    const next = await window.api.toggleFavorite(row.path)
    setResults((prev) =>
      prev.map((r) => (r.path === row.path ? { ...r, favorite: next } : r))
    )
    setMultiSelected((prev) => {
      if (!prev.has(row.path)) return prev
      const nextMap = new Map(prev)
      const target = nextMap.get(row.path)
      if (target) nextMap.set(row.path, { ...target, favorite: next })
      return nextMap
    })
  }

  async function revealRow(row: SoundRow, e: MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.revealInFolder(row.path)
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
    setSelectedSubcategory(subcategory)
  }

  function clearFilters(): void {
    setQuery('')
    setMaxDuration('')
    setChannels('')
    setSelectedCategory('')
    setSelectedSubcategory('')
    setFavoritesOnly(false)
  }

  const hasActiveFilters = (): boolean =>
    Boolean(
      query() ||
        maxDuration() ||
        channels() ||
        selectedCategory() ||
        selectedSubcategory() ||
        favoritesOnly()
    )

  async function selectAllFiltered(): Promise<void> {
    if (!folder()) return
    const seq = ++selectAllSeq
    const params = currentSearchParams()
    try {
      const all = await fetchAllMatchingSounds(window.api, params)
      if (seq === selectAllSeq) {
        setMultiSelected(all)
      }
    } catch {
      // If fetching fails, user keeps partial selection
    }
  }

  function openExportForRow(row: SoundRow, region: { start: number; end: number } | null): void {
    setExportFiles([
      {
        sourcePath: row.path,
        filename: row.filename,
        start: region?.start,
        end: region?.end
      }
    ])
    setExportModalOpen(true)
  }

  function openExportForSelection(region?: { start: number; end: number } | null): void {
    if (multiSelected().size > 0 && !region) {
      const files: ExportFile[] = []
      for (const row of multiSelected().values()) {
        files.push({
          sourcePath: row.path,
          filename: row.filename
        })
      }
      if (files.length > 0) {
        setExportFiles(files)
        setExportModalOpen(true)
        return
      }
    }

    const row = selectedRow()
    if (row) {
      openExportForRow(row, region ?? null)
    }
  }

  function openSlicer(region?: { start: number; end: number } | null): void {
    const row = selectedRow()
    if (!row) return
    waveApi?.pause()
    setSlicerSeed(region ?? null)
    setSlicerRow(row)
  }

  function openLoopTool(region?: { start: number; end: number } | null): void {
    const row = selectedRow()
    if (!row) return
    waveApi?.pause()
    setLoopSeed(region ?? null)
    setLoopRow(row)
  }

  function openCategoryModalForRow(row: SoundRow): void {
    setCategoryModalRows([row])
  }

  function openCategoryModalForSelection(): void {
    const rows = Array.from(multiSelected().values())
    if (rows.length === 0) return
    setCategoryModalRows(rows)
  }

  async function applyCategory(category: string, subcategory: string | null): Promise<void> {
    const targets = categoryModalRows()
    if (targets.length === 0) return
    const paths = targets.map((r) => r.path)
    await window.api.setCategories([...paths], category, subcategory)

    const pathSet = new Set(paths)
    setResults((prev) =>
      prev.map((row) =>
        pathSet.has(row.path)
          ? {
              ...row,
              category,
              subcategory,
              confidence: 1,
              matched_terms: ['manual'],
              category_manual: true
            }
          : row
      )
    )
    setMultiSelected(
      (prev) =>
        new Map(
          Array.from(prev.entries()).map(([p, row]) => [
            p,
            pathSet.has(p)
              ? {
                  ...row,
                  category,
                  subcategory,
                  confidence: 1,
                  matched_terms: ['manual'],
                  category_manual: true
                }
              : row
          ])
        )
    )
    setCategoryModalRows([])
    await refreshFacets()
  }

  async function removeCategory(): Promise<void> {
    const targets = categoryModalRows()
    if (targets.length === 0) return
    const paths = targets.map((r) => r.path)
    await window.api.clearCategories([...paths])

    const pathSet = new Set(paths)
    setResults((prev) =>
      prev.map((row) =>
        pathSet.has(row.path)
          ? {
              ...row,
              category: 'Uncategorized',
              subcategory: null,
              confidence: 0,
              matched_terms: [],
              category_manual: false
            }
          : row
      )
    )
    setMultiSelected(
      (prev) =>
        new Map(
          Array.from(prev.entries()).map(([p, row]) => [
            p,
            pathSet.has(p)
              ? {
                  ...row,
                  category: 'Uncategorized',
                  subcategory: null,
                  confidence: 0,
                  matched_terms: [],
                  category_manual: false
                }
              : row
          ])
        )
    )
    setCategoryModalRows([])
    await refreshFacets()
  }

  async function clearCategoryForSelection(): Promise<void> {
    const targets = Array.from(multiSelected().values())
    if (targets.length === 0) return
    const paths = targets.map((r) => r.path)
    await window.api.clearCategories([...paths])

    const pathSet = new Set(paths)
    setResults((prev) =>
      prev.map((row) =>
        pathSet.has(row.path)
          ? {
              ...row,
              category: 'Uncategorized',
              subcategory: null,
              confidence: 0,
              matched_terms: [],
              category_manual: false
            }
          : row
      )
    )
    setMultiSelected(
      (prev) =>
        new Map(
          Array.from(prev.entries()).map(([p, row]) => [
            p,
            pathSet.has(p)
              ? {
                  ...row,
                  category: 'Uncategorized',
                  subcategory: null,
                  confidence: 0,
                  matched_terms: [],
                  category_manual: false
                }
              : row
          ])
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
    const isInput =
      (active?.tagName === 'INPUT' &&
        !['range', 'checkbox', 'radio', 'button'].includes((active as HTMLInputElement).type)) ||
      active?.tagName === 'SELECT'

    if ((e.key === '?' || e.key === 'F1') && !isInput) {
      e.preventDefault()
      setShowHelp((prev) => !prev)
      return
    }

    if (e.altKey && e.key.toLowerCase() === 'a' && !isInput) {
      e.preventDefault()
      toggleAutoPlay()
      return
    }

    if (exportModalOpen() || categoryModalRows().length > 0 || showSettings() || slicerRow() || loopRow()) {
      return
    }

    if (e.key === 'Escape' && showHelp()) {
      e.preventDefault()
      setShowHelp(false)
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      openExportForSelection()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      openSlicer()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      openLoopTool()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault()
      pickFolder()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      toggleSidebar()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      searchInput?.focus()
      searchInput?.select()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isInput) {
      e.preventDefault()
      void selectAllFiltered()
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
    for (const row of multiSelected().values()) {
      sum += row.filesize ?? 0
    }
    return sum
  }

  return (
    <div id="app-root" class="w-screen h-screen flex flex-col overflow-hidden bg-[#2b2d30] text-[#f0f3f6] select-none text-md">
      <ToastContainer />

      {/* Workstation Menubar */}
      <WorkstationMenuBar
        hasFolder={Boolean(folder())}
        folderName={folder()?.folder}
        hasSelection={multiSelected().size > 0 || selectedRow() !== null}
        selectionCount={multiSelected().size > 0 ? multiSelected().size : (selectedRow() ? 1 : 0)}
        sidebarOpen={sidebarOpen()}
        infiniteScroll={infiniteScroll()}
        autoPlay={autoPlay()}
        favoritesOnly={favoritesOnly()}
        channels={channels()}
        reindexing={reindexing()}
        query={query()}
        onInputQuery={setQuery}
        matchingCount={matchingCount()}
        resultsCount={results().length}
        selectedCategory={selectedCategory()}
        selectedSubcategory={selectedSubcategory()}
        onClearCategory={() => {
          setSelectedCategory('')
          setSelectedSubcategory('')
        }}
        maxDuration={maxDuration()}
        onChangeMaxDuration={setMaxDuration}
        hasActiveFilters={hasActiveFilters()}
        searchInputRef={(el) => (searchInput = el)}
        onOpenFolder={pickFolder}
        onReindex={doReindex}
        onCloseFolder={() => setFolder(null)}
        onOpenExport={openExportForSelection}
        onOpenSlicer={() => openSlicer()}
        onOpenLoopTool={() => openLoopTool()}
        canSlice={selectedRow() !== null}
        onOpenSettings={() => setShowSettings(true)}
        onSelectAll={selectAllFiltered}
        onClearSelection={() => setMultiSelected(new Map())}
        onSetCategory={() => {
          if (multiSelected().size > 0) {
            openCategoryModalForSelection()
          } else if (selectedRow()) {
            openCategoryModalForRow(selectedRow()!)
          }
        }}
        onClearCategorySelection={() => {
          if (multiSelected().size > 0) {
            clearCategoryForSelection()
          } else if (selectedRow()) {
            setCategoryModalRows([selectedRow()!])
            removeCategory()
          }
        }}
        onClearFilters={clearFilters}
        onToggleFavorites={() => setFavoritesOnly((v) => !v)}
        onSetChannels={(ch) => setChannels(ch)}
        onToggleSidebar={toggleSidebar}
        onToggleInfiniteScroll={toggleInfiniteScroll}
        onToggleAutoPlay={toggleAutoPlay}
        onOpenHelp={() => setShowHelp(true)}
      />

      {/* Main Content Area */}
      <Show
        when={folder()}
        fallback={
          <WelcomeScreen
            onPickFolder={pickFolder}
            recent={recent()}
            onOpenRecent={openRecent}
            onRemoveRecent={removeRecent}
            appIcon={appIcon}
          />
        }
      >
        {/* Main Split Layout: Categories Sidebar on Left, Library Column (Table + Waveform) on Right */}
        <div id="app-workspace" class="flex flex-1 min-h-0 w-full overflow-hidden relative">
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
            onToggleOpen={toggleSidebar}
            onOpen={() => setSidebarOpen(true)}
          />

          {/* Library Column: Sound Table + Waveform Drawer */}
          <div id="app-library-column" class="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

            {/* Reindex Thin Progress Line */}
            <Show when={reindexing()}>
              <div id="app-reindex-progress" class="h-0.5 w-full bg-[#1c1d1f] overflow-hidden shrink-0">
                <div class="h-full bg-[#007acc] transition-all duration-150" style={{ width: `${progressPct()}%` }} />
              </div>
            </Show>

            <SoundTable
              results={results()}
              selected={selected()}
              multiSelected={multiSelected()}
              multiSelectTotalSize={multiSelectTotalSize()}
              sortBy={sortBy()}
              sortDir={sortDir()}
              loadingMore={loadingMore()}
              matchingCount={matchingCount()}
              infiniteScroll={infiniteScroll()}
              listContainerRef={(el) => (listContainer = el)}
              onListScroll={onListScroll}
              onToggleSort={toggleSort}
              onRowClick={onRowClick}
              onRowDblClick={onRowDblClick}
              onRowDragStart={onRowDragStart}
              onToggleFavorite={toggleRowFavorite}
              onOpenCategoryModal={openCategoryModalForRow}
              onRevealRow={revealRow}
              onExportRow={(row) => openExportForRow(row, null)}
              onExportSelected={openExportForSelection}
              onCategorizeSelected={openCategoryModalForSelection}
              onClearCategorySelected={clearCategoryForSelection}
              onClearMultiSelection={() => setMultiSelected(new Map())}
              onLoadMore={loadMore}
              formatDuration={formatDuration}
              formatSize={formatSize}
            />
          </div>
        </div>

        {/* Waveform Bottom Dock Panel - Full Width across bottom */}
        <WaveformPreview
          row={selectedRow()}
          selectedCount={multiSelected().size > 0 ? multiSelected().size : (selectedRow() ? 1 : 0)}
          onApi={(api) => (waveApi = api)}
          onExportRequest={(region) => {
            openExportForSelection(region)
          }}
          onSliceRequest={openSlicer}
          onLoopRequest={openLoopTool}
        />
      </Show>

      {/* Workstation Bottom Status Bar */}
      <WorkstationStatusBar
        folder={folder()}
        resultsCount={results().length}
        matchingCount={matchingCount()}
        multiSelectedCount={multiSelected().size}
        infiniteScroll={infiniteScroll()}
        onToggleInfiniteScroll={toggleInfiniteScroll}
        autoPlay={autoPlay()}
        onToggleAutoPlay={toggleAutoPlay}
        selectedRow={selectedRow()}
        formatSize={formatSize}
        onOpenHelp={() => setShowHelp(true)}
      />

      {/* Help Modal Guide */}
      <HelpModal isOpen={showHelp()} onClose={() => setShowHelp(false)} />

      {/* Settings Modal (MCP toggle + connection info + Theme selector) */}
      <SettingsModal isOpen={showSettings()} onClose={() => setShowSettings(false)} />

      {/* Slicer: mark many regions of one sound, export each as its own file.
          Rendered before the export modal so that one stacks on top. */}
      <SlicerModal
        row={slicerRow()}
        seedRegion={slicerSeed()}
        blocked={exportModalOpen()}
        onClose={() => setSlicerRow(null)}
        onExport={(files) => {
          setExportFiles(files)
          setExportModalOpen(true)
        }}
      />

      {/* Seamless Loop: crossfade a region's tail into its head, export the loop. */}
      <SeamlessLoopModal
        row={loopRow()}
        seedRegion={loopSeed()}
        blocked={exportModalOpen()}
        onClose={() => setLoopRow(null)}
        onExport={(files) => {
          setExportFiles(files)
          setExportModalOpen(true)
        }}
      />

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
      <ScanningOverlay
        isOpen={reindexing()}
        progress={progress()}
        progressPct={progressPct()}
      />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <MainWorkstation />
    </ThemeProvider>
  )
}
