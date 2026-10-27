import { createSignal, createEffect, Show, onCleanup, onMount } from 'solid-js'
import type { SoundRow, RecentEntry, CategoryFacet, SearchParams, SortColumn, SortDir, SoundState } from '../../preload/index'
import WaveformPreview, { WaveformApi } from './components/WaveformPreview'
import HelpModal from './components/HelpModal'
import SettingsModal from './components/SettingsModal'
import ExportModal, { ExportFile } from './components/ExportModal'
import CategoryModal from './components/CategoryModal'
import SlicerModal from './components/SlicerModal'
import SeamlessLoopModal from './components/SeamlessLoopModal'
import EffectsModal, { type EffectsItem, type SendTarget } from './components/EffectsModal'
import { CategorySidebar, type SidebarMode } from './components/CategorySidebar'
import { fetchAllMatchingSounds } from './selection'
import { ThemeProvider } from './themes/context'
import { WorkstationMenuBar } from './components/workstation/WorkstationMenuBar'
import { SoundTable } from './components/workstation/SoundTable'
import { WorkstationStatusBar } from './components/workstation/WorkstationStatusBar'
import { WelcomeScreen } from './components/workstation/WelcomeScreen'
import { ScanningOverlay } from './components/workstation/ScanningOverlay'
import { ToastContainer, showToast } from './components/ui/Toast'
import { ContextMenu, type MenuItem } from './components/ui/ContextMenu'
import {
  Copy,
  Download,
  Folder,
  FolderOpen,
  Play,
  Repeat,
  Scissors,
  SlidersHorizontal,
  Star,
  Tag,
  TagX
} from 'lucide-solid'
import { clearHistory, recordEdit, redo, redoLabel, undo, undoLabel } from './libraryHistory'
import { initProcessing } from './processingStore'
import type { ProcessingSettings } from '../../shared/processing'
import type { FolderNode } from '../../shared/folders'
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
  const [sidebarMode, setSidebarMode] = createSignal<SidebarMode>(
    localStorage.getItem('slipsound:sidebar-mode') === 'folders' ? 'folders' : 'categories'
  )
  const [folderTree, setFolderTree] = createSignal<FolderNode | null>(null)
  // Absolute path of the folder the list is limited to ('' = whole library).
  const [selectedFolder, setSelectedFolder] = createSignal('')
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
  // Effects chosen in the Effects window for this export (pre-selected in the dialog).
  const [exportProcessing, setExportProcessing] = createSignal<ProcessingSettings | undefined>()
  const [effectsItems, setEffectsItems] = createSignal<EffectsItem[]>([])
  const [effectsNoun, setEffectsNoun] = createSignal('sounds')
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
        void refreshFolders()
        runSearch()
      })
    )

    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
    void initProcessing()
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

  async function refreshFolders(): Promise<void> {
    const tree = await window.api.getFolderTree()
    setFolderTree(tree)
    // Drop a selected folder that no longer exists after a reindex.
    const sel = selectedFolder()
    if (sel && tree) {
      const exists = (n: FolderNode): boolean => n.path === sel || n.children.some(exists)
      if (!exists(tree)) setSelectedFolder('')
    }
  }

  // A different library: its own folders, and no folder filter carried over.
  let lastLibrary: string | null = null
  createEffect(() => {
    const lib = folder()?.folder ?? null
    if (lib === lastLibrary) return
    lastLibrary = lib
    clearHistory()
    setSelectedFolder('')
    setFolderTree(null)
    if (lib) void refreshFolders()
  })

  // Switching the sidebar view clears the other view's filter, so nothing filters
  // the list without being visible.
  function changeSidebarMode(mode: SidebarMode): void {
    if (mode === sidebarMode()) return
    setSidebarMode(mode)
    try {
      localStorage.setItem('slipsound:sidebar-mode', mode)
    } catch {
      // ignore
    }
    if (mode === 'folders') {
      setSelectedCategory('')
      setSelectedSubcategory('')
    } else {
      setSelectedFolder('')
    }
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
    folder: selectedFolder() || undefined,
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
    e.preventDefault()
    const selectedPaths = multiSelected().has(row.path)
      ? Array.from(multiSelected().keys())
      : [row.path]
    window.api.startDrag(selectedPaths)
  }

  // Merges fresh category/favorite state into the visible rows and selection.
  function applyStates(states: SoundState[]): void {
    const byPath = new Map(states.map((st) => [st.path, st]))
    const merge = (row: SoundRow): SoundRow => {
      const st = byPath.get(row.path)
      return st ? { ...row, ...st } : row
    }
    setResults((prev) => prev.map(merge))
    setMultiSelected((prev) => new Map(Array.from(prev.entries()).map(([p, row]) => [p, merge(row)])))
  }

  // Runs a library edit with undo support, then updates the UI and offers Undo.
  async function editLibrary(label: string, paths: string[], apply: () => Promise<unknown>, quiet = false): Promise<void> {
    if (paths.length === 0) return
    applyStates(await recordEdit(label, paths, apply))
    await refreshFacets()
    if (!quiet) showToast({ type: 'success', title: label, action: { label: 'Undo', onClick: () => void undoEdit() } })
  }

  async function undoEdit(): Promise<void> {
    const res = await undo()
    if (!res) return
    applyStates(res.states)
    await refreshFacets()
    showToast({ type: 'info', title: `Undid: ${res.label}`, action: { label: 'Redo', onClick: () => void redoEdit() } })
  }

  async function redoEdit(): Promise<void> {
    const res = await redo()
    if (!res) return
    applyStates(res.states)
    await refreshFacets()
    showToast({ type: 'info', title: `Redid: ${res.label}` })
  }

  // ---- Right-click menu on a sound ----
  // Acts on the multi-selection when the clicked sound is part of it, else on that sound.
  const [rowMenu, setRowMenu] = createSignal<{ x: number; y: number; index: number; targets: SoundRow[] } | null>(null)

  function onRowContextMenu(index: number, e: MouseEvent): void {
    e.preventDefault()
    const row = results()[index]
    if (!row) return
    const inSelection = multiSelected().has(row.path)
    if (!inSelection) {
      setMultiSelected(new Map())
      setSelected(index)
    }
    const targets = inSelection ? Array.from(multiSelected().values()) : [row]
    setRowMenu({ x: e.clientX, y: e.clientY, index, targets })
  }

  const folderOf = (p: string): string => p.slice(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')))

  function showInFolders(row: SoundRow): void {
    changeSidebarMode('folders')
    setSidebarOpen(true)
    const dir = folderOf(row.path)
    setSelectedFolder(dir === folder()?.folder ? '' : dir)
  }

  const rowMenuItems = (): MenuItem[] => {
    const m = rowMenu()
    if (!m) return []
    const one = m.targets.length === 1 ? m.targets[0] : null
    const n = m.targets.length
    const paths = m.targets.map((r) => r.path)
    const allFav = m.targets.every((r) => r.favorite)
    const many = (label: string): string => (one ? label : `${label} (${n})`)
    return [
      { id: 'row-menu-play', label: 'Play', shortcut: 'Space', icon: Play, disabled: !one, onClick: () => { setSelected(m.index); waveApi?.play() } },
      { id: 'row-menu-effects', label: many('Effects…'), shortcut: 'Ctrl+P', icon: SlidersHorizontal, onClick: () => openEffects() },
      { id: 'row-menu-slice', label: 'Slice…', shortcut: 'Ctrl+K', icon: Scissors, disabled: !one, onClick: () => openSlicer() },
      { id: 'row-menu-loop', label: 'Make Seamless Loop…', shortcut: 'Ctrl+L', icon: Repeat, disabled: !one, onClick: () => openLoopTool() },
      { id: 'row-menu-div-1', isDivider: true },
      { id: 'row-menu-export', label: many('Export…'), shortcut: 'Ctrl+E', icon: Download, onClick: () => openExportForSelection() },
      { id: 'row-menu-reveal', label: 'Reveal in File Manager', icon: FolderOpen, disabled: !one, onClick: () => one && window.api.revealInFolder(one.path) },
      { id: 'row-menu-show-folder', label: 'Show in Folders', icon: Folder, disabled: !one, onClick: () => one && showInFolders(one) },
      {
        id: 'row-menu-copy-path',
        label: one ? 'Copy Path' : `Copy ${n} Paths`,
        icon: Copy,
        onClick: () => {
          void navigator.clipboard.writeText(paths.join('\n'))
          showToast({ type: 'success', title: one ? 'Path copied' : `${n} paths copied` })
        }
      },
      { id: 'row-menu-div-2', isDivider: true },
      {
        id: 'row-menu-favorite',
        label: many(allFav ? 'Remove from Favorites' : 'Add to Favorites'),
        icon: Star,
        onClick: () =>
          void editLibrary(
            allFav ? `Removed ${plural(n)} from favorites` : `Added ${plural(n)} to favorites`,
            paths,
            () => window.api.setFavorites(paths, !allFav),
            !!one
          )
      },
      { id: 'row-menu-set-category', label: many('Set Category…'), icon: Tag, onClick: () => setCategoryModalRows(m.targets) },
      {
        id: 'row-menu-clear-category',
        label: many('Clear Category'),
        icon: TagX,
        disabled: m.targets.every((r) => r.category === 'Uncategorized' && !r.category_manual),
        onClick: () =>
          void editLibrary(`Cleared category on ${plural(n)}`, paths, () => window.api.clearCategories(paths))
      }
    ]
  }

  const plural = (n: number): string => `${n} sound${n === 1 ? '' : 's'}`

  async function toggleRowFavorite(row: SoundRow, e?: MouseEvent): Promise<void> {
    e?.stopPropagation()
    // A single star click is easy to see and reverse, so no toast; Ctrl+Z still works.
    await editLibrary(row.favorite ? 'Unfavorite' : 'Favorite', [row.path], () => window.api.toggleFavorite(row.path), true)
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
    setSelectedFolder('')
    setFavoritesOnly(false)
  }

  const hasActiveFilters = (): boolean =>
    Boolean(
      query() ||
        maxDuration() ||
        channels() ||
        selectedCategory() ||
        selectedSubcategory() ||
        selectedFolder() ||
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

  function openExport(files: ExportFile[], processing?: ProcessingSettings): void {
    setExportFiles(files)
    setExportProcessing(processing)
    setExportModalOpen(true)
  }

  function openExportForRow(row: SoundRow, region: { start: number; end: number } | null): void {
    setExportProcessing(undefined)
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
        openExport(files)
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

  // Effects work on the multi-selection, or the selected sound (and its region).
  function openEffects(region?: { start: number; end: number } | null): void {
    const rows = multiSelected().size > 0 ? Array.from(multiSelected().values()) : selectedRow() ? [selectedRow()!] : []
    if (rows.length === 0) return
    waveApi?.pause()
    openEffectsFor(rows.map((row) => ({ row, region: rows.length === 1 ? (region ?? null) : null })))
  }

  function openEffectsFor(items: EffectsItem[], noun = 'sounds'): void {
    setEffectsNoun(noun)
    setEffectsItems(items)
  }

  // Effects result into another tool: Effects closes, the tool opens on the render.
  function sendEffectsResult(target: SendTarget, row: SoundRow): void {
    // Only the destination tool stays open, so it isn't hidden under the other one.
    setEffectsItems([])
    if (target === 'slicer') {
      setLoopRow(null)
      setSlicerSeed(null)
      setSlicerRow(row)
    } else {
      setSlicerRow(null)
      setLoopSeed(null)
      setLoopRow(row)
    }
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
    const paths = categoryModalRows().map((r) => r.path)
    setCategoryModalRows([])
    await editLibrary(
      `Set ${plural(paths.length)} to ${subcategory ? `${category} / ${subcategory}` : category}`,
      paths,
      () => window.api.setCategories([...paths], category, subcategory)
    )
  }

  async function removeCategory(): Promise<void> {
    const paths = categoryModalRows().map((r) => r.path)
    setCategoryModalRows([])
    await editLibrary(`Cleared category on ${plural(paths.length)}`, paths, () =>
      window.api.clearCategories([...paths])
    )
  }

  async function clearCategoryForSelection(): Promise<void> {
    const paths = Array.from(multiSelected().keys())
    await editLibrary(`Cleared category on ${plural(paths.length)}`, paths, () =>
      window.api.clearCategories([...paths])
    )
  }

  createEffect(() => {
    query()
    maxDuration()
    channels()
    selectedCategory()
    selectedSubcategory()
    selectedFolder()
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

    if (exportModalOpen() || categoryModalRows().length > 0 || showSettings() || slicerRow() || loopRow() || effectsItems().length > 0) {
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

    if ((e.ctrlKey || e.metaKey) && !isInput && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault()
      void redoEdit()
      return
    }

    if ((e.ctrlKey || e.metaKey) && !isInput && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      void undoEdit()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      openSlicer()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      openEffects()
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
        selectedFolder={selectedFolder()}
        libraryRoot={folder()?.folder ?? ''}
        onClearFolder={() => setSelectedFolder('')}
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
        onOpenEffects={() => openEffects()}
        undoLabel={undoLabel()}
        redoLabel={redoLabel()}
        onUndo={() => void undoEdit()}
        onRedo={() => void redoEdit()}
        onOpenDragFolder={() => void window.api.openDragFolder()}
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
            mode={sidebarMode()}
            onModeChange={changeSidebarMode}
            folderTree={folderTree()}
            selectedFolder={selectedFolder()}
            onSelectFolder={setSelectedFolder}
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
              onRowContextMenu={onRowContextMenu}
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
          onEffectsRequest={openEffects}
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

      <ContextMenu
        id="row-context-menu"
        isOpen={rowMenu() !== null}
        x={rowMenu()?.x ?? 0}
        y={rowMenu()?.y ?? 0}
        items={rowMenuItems()}
        onClose={() => setRowMenu(null)}
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
        blocked={exportModalOpen() || effectsItems().length > 0}
        onClose={() => setSlicerRow(null)}
        onExport={(files) => openExport(files)}
        onEffects={(items) => openEffectsFor(items, 'slices')}
      />

      {/* Seamless Loop: crossfade a region's tail into its head, export the loop. */}
      <SeamlessLoopModal
        row={loopRow()}
        seedRegion={loopSeed()}
        blocked={exportModalOpen() || effectsItems().length > 0}
        onClose={() => setLoopRow(null)}
        onExport={(files) => openExport(files.map((f) => ({ ...f, excludeFades: true })))}
        onEffects={(items) => openEffectsFor(items)}
      />

      {/* Effects: preview and render reverse/pitch/speed/fades/level to new files. */}
      <EffectsModal
        items={effectsItems()}
        noun={effectsNoun()}
        blocked={exportModalOpen()}
        onClose={() => setEffectsItems([])}
        onExport={(files, processing) => openExport(files, processing)}
        onSendTo={sendEffectsResult}
      />

      {/* Shared Export Wizard Modal */}
      <ExportModal
        open={exportModalOpen()}
        files={exportFiles()}
        processing={exportProcessing()}
        onClose={() => setExportModalOpen(false)}
      />

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
