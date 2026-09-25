import { createSignal, createMemo, createEffect, For, Show, JSX } from 'solid-js'
import { Badge } from './ui/Badge'
import { SearchInput } from './ui/SearchInput'
import { IconButton } from './ui/IconButton'
import {
  TagIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LayersIcon,
  ZapIcon,
  ActivityIcon,
  WaveformIcon,
  SlidersIcon,
  MousePointerIcon,
  StarIcon,
  Volume2Icon
} from './icons'

export interface CategorySidebarProps {
  facets: { category: string; subcategory: string | null; count: number }[]
  selectedCategory: string
  selectedSubcategory: string
  totalSounds: number
  isOpen: boolean
  onSelectCategory: (category: string) => void
  onSelectSubcategory: (subcategory: string) => void
  onClear: () => void
  onClose: () => void
  onToggleOpen?: () => void
  onOpen?: () => void
}

interface CategoryGroup {
  category: string
  totalCount: number
  subcategories: { subcategory: string; count: number }[]
}

const EXPANDED_STORAGE_KEY = 'slipsound:sidebar-expanded'
const WIDTH_STORAGE_KEY = 'slipsound:sidebar-width'

function loadSavedExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr)
    }
  } catch {
    // fallback
  }
  return new Set()
}

function saveExpanded(expanded: Set<string>): void {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...expanded]))
  } catch {
    // ignore
  }
}

function loadSavedWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY)
    if (raw) {
      const w = parseInt(raw, 10)
      if (!isNaN(w) && w >= 190 && w <= 500) return w
    }
  } catch {
    // fallback
  }
  return 270
}

function getCategoryIcon(category: string): JSX.Element {
  const c = category.toLowerCase()
  if (c.includes('weapon') || c.includes('gun') || c.includes('shot')) {
    return <ZapIcon size={13} class="shrink-0 text-[#007acc]" />
  }
  if (c.includes('explos') || c.includes('impact') || c.includes('hit') || c.includes('crash')) {
    return <ActivityIcon size={13} class="shrink-0 text-[#007acc]" />
  }
  if (c.includes('foley') || c.includes('cloth') || c.includes('footstep') || c.includes('step')) {
    return <LayersIcon size={13} class="shrink-0 text-[#007acc]" />
  }
  if (c.includes('magic') || c.includes('spell') || c.includes('fantasy')) {
    return <StarIcon size={13} class="shrink-0 text-[#007acc]" />
  }
  if (c.includes('ui') || c.includes('button') || c.includes('menu') || c.includes('click')) {
    return <MousePointerIcon size={13} class="shrink-0 text-[#007acc]" />
  }
  if (c.includes('electronic') || c.includes('synth') || c.includes('glitch') || c.includes('ambience')) {
    return <WaveformIcon size={13} class="shrink-0 text-[#007acc]" />
  }
  if (c.includes('mechanic') || c.includes('gear') || c.includes('engine') || c.includes('vehicle')) {
    return <SlidersIcon size={13} class="shrink-0 text-[#007acc]" />
  }
  if (c.includes('vocal') || c.includes('voice') || c.includes('creature')) {
    return <Volume2Icon size={13} class="shrink-0 text-[#007acc]" />
  }
  return <TagIcon size={13} class="shrink-0 text-[#007acc]" />
}

export function CategorySidebar(props: CategorySidebarProps): JSX.Element {
  const [expanded, setExpandedState] = createSignal<Set<string>>(loadSavedExpanded())
  const [filterText, setFilterText] = createSignal('')
  const [width, setWidth] = createSignal(loadSavedWidth())

  let preFilterExpanded: Set<string> | null = null
  let isResizing = false
  let startX = 0
  let startWidth = 0

  function onResizeMouseDown(e: MouseEvent): void {
    e.preventDefault()
    isResizing = true
    startX = e.clientX
    startWidth = width()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (moveEvent: MouseEvent): void => {
      if (!isResizing) return
      const delta = moveEvent.clientX - startX
      const newWidth = Math.min(500, Math.max(190, startWidth + delta))
      setWidth(newWidth)
    }

    const onMouseUp = (): void => {
      if (isResizing) {
        isResizing = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        try {
          localStorage.setItem(WIDTH_STORAGE_KEY, String(width()))
        } catch {
          // ignore
        }
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function updateExpanded(updater: (prev: Set<string>) => Set<string>): void {
    setExpandedState((prev) => {
      const next = updater(prev)
      if (!filterText().trim()) {
        saveExpanded(next)
      }
      return next
    })
  }

  // Derive grouped categories with their subcategories
  const categoryGroups = createMemo<CategoryGroup[]>(() => {
    const map = new Map<string, { total: number; subs: Map<string, number> }>()

    for (const f of props.facets) {
      if (!map.has(f.category)) {
        map.set(f.category, { total: 0, subs: new Map() })
      }
      const entry = map.get(f.category)!
      entry.total += f.count
      if (f.subcategory) {
        entry.subs.set(f.subcategory, (entry.subs.get(f.subcategory) ?? 0) + f.count)
      }
    }

    const groups: CategoryGroup[] = []
    for (const [cat, data] of map.entries()) {
      const subs = [...data.subs.entries()]
        .map(([subcategory, count]) => ({ subcategory, count }))
        .sort((a, b) => a.subcategory.localeCompare(b.subcategory, undefined, { sensitivity: 'base' }))

      groups.push({
        category: cat,
        totalCount: data.total,
        subcategories: subs
      })
    }

    return groups.sort((a, b) => {
      if (a.category === 'Uncategorized') return 1
      if (b.category === 'Uncategorized') return -1
      return a.category.localeCompare(b.category, undefined, { sensitivity: 'base' })
    })
  })

  // Filtered categories based on search input
  const filteredGroups = createMemo(() => {
    const q = filterText().trim().toLowerCase()
    if (!q) return categoryGroups()

    return categoryGroups().filter((group) => {
      if (group.category.toLowerCase().includes(q)) return true
      return group.subcategories.some((s) => s.subcategory.toLowerCase().includes(q))
    })
  })

  // Toggle single accordion section
  function toggleExpand(category: string, e?: MouseEvent): void {
    e?.stopPropagation()
    updateExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const expandableCategories = createMemo(() =>
    categoryGroups()
      .filter((g) => g.subcategories.length > 0)
      .map((g) => g.category)
  )

  const isAllExpanded = () => {
    const expandable = expandableCategories()
    return expandable.length > 0 && expandable.every((c) => expanded().has(c))
  }

  // Toggle all expand/collapse
  function toggleAll(): void {
    if (isAllExpanded()) {
      updateExpanded(() => new Set())
    } else {
      updateExpanded(() => new Set(expandableCategories()))
    }
  }

  // Auto-expand on search, and restore previous state when search is cleared
  createEffect(() => {
    const q = filterText().trim()
    if (q) {
      if (preFilterExpanded === null) {
        preFilterExpanded = new Set(expanded())
      }
      const matches = filteredGroups()
        .filter((g) => g.subcategories.length > 0)
        .map((g) => g.category)
      setExpandedState(new Set(matches))
    } else {
      if (preFilterExpanded !== null) {
        setExpandedState(preFilterExpanded)
        preFilterExpanded = null
      }
    }
  })

  function handleCategoryClick(category: string): void {
    if (props.selectedCategory === category) {
      props.onClear()
    } else {
      props.onSelectCategory(category)
      // Auto-expand on select if not already expanded
      updateExpanded((prev) => {
        const next = new Set(prev)
        next.add(category)
        return next
      })
    }
  }

  function handleCategoryDblClick(category: string, e: MouseEvent): void {
    e.stopPropagation()
    toggleExpand(category)
  }

  const isAllSoundsActive = () => !props.selectedCategory

  return (
    <Show
      when={props.isOpen}
      fallback={
        /* Collapsed Sidebar Rail: Never fully disappears, shows vertically stacked CATEGORIES label */
        <aside
          id="category-sidebar-collapsed"
          class="flex flex-col items-center justify-between w-8 min-w-[32px] h-full bg-[#26282b] border-r border-[#1c1d1f] select-none shrink-0 py-3 cursor-pointer group hover:bg-[#32353a] transition-colors"
          onClick={() => {
            if (props.onOpen) props.onOpen()
            else if (props.onToggleOpen) props.onToggleOpen()
          }}
          title="Expand Categories (Ctrl+B)"
        >
          <div class="flex flex-col items-center gap-2">
            <div class="w-6 h-6 rounded flex items-center justify-center text-[#007acc] group-hover:text-white transition-colors">
              <TagIcon size={14} />
            </div>
            <div class="w-3.5 h-px bg-[#1c1d1f] group-hover:bg-[#007acc]/40 transition-colors" />
          </div>

          {/* Vertically stacked CATEGORIES text */}
          <div class="flex-1 flex items-center justify-center my-4 overflow-hidden">
            <span
              id="category-sidebar-vertical-label"
              class="font-bold text-md tracking-[0.25em] uppercase text-[#8b949e] group-hover:text-[#f0f3f6] transition-colors select-none whitespace-nowrap"
              style={{
                'writing-mode': 'vertical-rl',
                'transform': 'rotate(180deg)'
              }}
            >
              Categories
            </span>
          </div>

          <div class="flex flex-col items-center gap-1.5 text-[#8b949e] group-hover:text-[#007acc] transition-colors">
            <ChevronRightIcon size={14} />
          </div>
        </aside>
      }
    >
      <aside
        id="category-sidebar"
        class="relative flex flex-col h-full bg-[#26282b] border-r border-[#1c1d1f] select-none shrink-0 overflow-hidden"
        style={{
          width: `${width()}px`
        }}
      >
      {/* Sidebar Header */}
      <div id="category-sidebar-header" class="h-11 min-h-[44px] px-3 bg-[#26282b] border-b border-[#1c1d1f] flex items-center justify-between shrink-0">
        <div id="category-sidebar-title" class="flex items-center gap-1.5 font-bold text-md uppercase tracking-wider text-[#f0f3f6]">
          <TagIcon size={14} class="shrink-0 text-[#007acc]" />
          <span>Categories</span>
          <Badge variant="default" class="ml-1 text-md">{categoryGroups().length}</Badge>
        </div>

        <div id="category-sidebar-header-actions" class="flex items-center gap-1.5">
          <IconButton
            id="category-sidebar-toggle-all-btn"
            size="sm"
            active={isAllExpanded()}
            tooltip={isAllExpanded() ? 'Collapse all categories' : 'Expand all categories'}
            onClick={toggleAll}
          >
            <Show when={isAllExpanded()} fallback={<ChevronDownIcon size={13} />}>
              <ChevronUpIcon size={13} />
            </Show>
          </IconButton>
          <IconButton
            id="category-sidebar-close-btn"
            size="sm"
            tooltip="Collapse categories sidebar (Ctrl+B)"
            onClick={props.onClose}
          >
            <ChevronLeftIcon size={14} />
          </IconButton>
        </div>
      </div>

      {/* Quick Search within Categories */}
      <Show when={categoryGroups().length > 4}>
        <div id="category-filter-container" class="px-2.5 py-1.5 border-b border-[#1c1d1f] bg-[#26282b]">
          <SearchInput
            id="category-filter-input"
            value={filterText()}
            onInput={setFilterText}
            placeholder="Filter categories…"
            onClear={() => setFilterText('')}
          />
        </div>
      </Show>

      {/* Root "All Sounds" Item */}
      <div id="category-sidebar-list" class="flex-1 overflow-y-auto min-h-0 dcc-scroll py-1.5 flex flex-col">
        <div
          id="category-item-all-sounds"
          class="flex items-center justify-between px-2.5 h-8 min-h-[32px] mx-1.5 rounded-[3px] cursor-pointer text-md transition-colors"
          classList={{
            'bg-[#007acc] text-white font-medium shadow-xs': isAllSoundsActive(),
            'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]': !isAllSoundsActive()
          }}
          onClick={props.onClear}
          title={`Show all ${props.totalSounds} sounds`}
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <div class="w-4 h-4 flex items-center justify-center shrink-0">
              <LayersIcon size={14} class={isAllSoundsActive() ? 'text-white' : 'text-[#007acc]'} />
            </div>
            <span class="truncate flex-1">All Sounds</span>
            <span class="font-mono text-md opacity-75 tabular-nums">{props.totalSounds}</span>
          </div>
        </div>

        {/* Categories Accordion */}
        <For
          each={filteredGroups()}
          fallback={
            <div id="category-sidebar-empty" class="p-4 text-center text-md text-[#8b949e]">
              <span>No categories match "{filterText()}"</span>
            </div>
          }
        >
          {(group) => {
            const isCategoryActive = () => props.selectedCategory === group.category
            const isExpanded = () => expanded().has(group.category)
            const catId = group.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')

            return (
              <div id={`category-group-${catId}`} class="flex flex-col mx-1.5 mb-0.5">
                {/* Category Header Row */}
                <div
                  id={`category-item-${catId}`}
                  class="flex items-center gap-1 px-1 h-8 min-h-[32px] rounded-[3px] cursor-pointer text-md transition-colors group"
                  classList={{
                    'bg-[#007acc] text-white font-medium shadow-xs': isCategoryActive() && !props.selectedSubcategory,
                    'bg-[#007acc]/15 text-[#f0f3f6]': isCategoryActive() && Boolean(props.selectedSubcategory),
                    'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]': !isCategoryActive()
                  }}
                  onClick={() => handleCategoryClick(group.category)}
                  onDblClick={(e) => handleCategoryDblClick(group.category, e)}
                  title={`Filter by ${group.category} (${group.totalCount} sounds) - Double click to toggle`}
                >
                  <Show
                    when={group.subcategories.length > 0}
                    fallback={<div class="w-6 h-6 min-w-[24px] min-h-[24px] shrink-0" />}
                  >
                    <button
                      id={`category-toggle-subcategories-${catId}`}
                      type="button"
                      class="w-6 h-6 min-w-[24px] min-h-[24px] flex items-center justify-center rounded text-current opacity-70 hover:opacity-100 hover:bg-white/10 transition-all cursor-pointer"
                      classList={{ 'rotate-90': isExpanded() }}
                      onClick={(e) => toggleExpand(group.category, e)}
                      title={isExpanded() ? 'Collapse subcategories' : 'Expand subcategories'}
                    >
                      <ChevronRightIcon size={13} />
                    </button>
                  </Show>

                  {getCategoryIcon(group.category)}
                  <span class="truncate flex-1 ml-1">{group.category}</span>
                  <span class="font-mono text-md opacity-75 tabular-nums ml-1 pr-1">{group.totalCount}</span>
                </div>

                {/* Subcategories Accordion Content */}
                <Show when={isExpanded() && group.subcategories.length > 0}>
                  <div id={`subcategory-list-${catId}`} class="flex flex-col pl-5 pr-1 py-0.5 gap-0.5">
                    <For each={group.subcategories}>
                      {(sub) => {
                        const isSubActive = () =>
                          isCategoryActive() && props.selectedSubcategory === sub.subcategory
                        const subId = sub.subcategory.toLowerCase().replace(/[^a-z0-9]+/g, '-')

                        return (
                          <div
                            id={`subcategory-item-${catId}-${subId}`}
                            class="flex items-center justify-between px-2 h-7 min-h-[28px] rounded-[3px] cursor-pointer text-md transition-colors"
                            classList={{
                              'bg-[#007acc] text-white font-medium shadow-xs': isSubActive(),
                              'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]': !isSubActive()
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isSubActive()) {
                                props.onSelectSubcategory('')
                              } else {
                                if (props.selectedCategory !== group.category) {
                                  props.onSelectCategory(group.category)
                                }
                                props.onSelectSubcategory(sub.subcategory)
                              }
                            }}
                            title={`Filter by ${group.category} > ${sub.subcategory} (${sub.count} sounds)`}
                          >
                            <span class="w-1.5 h-1.5 rounded-full bg-current opacity-40 mr-2 shrink-0" />
                            <span class="truncate flex-1">{sub.subcategory}</span>
                            <span class="font-mono text-md opacity-75 tabular-nums ml-1">{sub.count}</span>
                          </div>
                        )
                      }}
                    </For>
                  </div>
                </Show>
              </div>
            )
          }}
        </For>
      </div>

      {/* Draggable resize handle */}
      <div
        id="category-sidebar-resize-handle"
        class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#007acc] transition-colors z-10"
        onMouseDown={onResizeMouseDown}
        title="Drag to resize sidebar"
      />
      </aside>
    </Show>
  )
}

