import { createSignal, createMemo, createEffect, For, Show, JSX } from 'solid-js'
import {
  TagIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
  SearchIcon,
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
    return <ZapIcon size={13} class="category-item-icon" />
  }
  if (c.includes('explos') || c.includes('impact') || c.includes('hit') || c.includes('crash')) {
    return <ActivityIcon size={13} class="category-item-icon" />
  }
  if (c.includes('foley') || c.includes('cloth') || c.includes('footstep') || c.includes('step')) {
    return <LayersIcon size={13} class="category-item-icon" />
  }
  if (c.includes('magic') || c.includes('spell') || c.includes('fantasy')) {
    return <StarIcon size={13} class="category-item-icon" />
  }
  if (c.includes('ui') || c.includes('button') || c.includes('menu') || c.includes('click')) {
    return <MousePointerIcon size={13} class="category-item-icon" />
  }
  if (c.includes('electronic') || c.includes('synth') || c.includes('glitch') || c.includes('ambience')) {
    return <WaveformIcon size={13} class="category-item-icon" />
  }
  if (c.includes('mechanic') || c.includes('gear') || c.includes('engine') || c.includes('vehicle')) {
    return <SlidersIcon size={13} class="category-item-icon" />
  }
  if (c.includes('vocal') || c.includes('voice') || c.includes('creature')) {
    return <Volume2Icon size={13} class="category-item-icon" />
  }
  return <TagIcon size={13} class="category-item-icon" />
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
    <aside
      class="category-sidebar"
      style={{
        width: `${width()}px`,
        display: props.isOpen ? 'flex' : 'none'
      }}
    >
      {/* Sidebar Header */}
      <div class="category-sidebar-header">
        <div class="category-sidebar-title">
          <TagIcon size={14} class="sidebar-title-icon" />
          <span>Categories</span>
          <span class="category-count-badge tabular">{categoryGroups().length}</span>
        </div>

        <div class="category-sidebar-actions">
          <button
            class="sidebar-action-btn"
            classList={{ 'action-active': isAllExpanded() }}
            title={isAllExpanded() ? 'Collapse all categories' : 'Expand all categories'}
            onClick={toggleAll}
          >
            <Show when={isAllExpanded()} fallback={<ChevronDownIcon size={14} />}>
              <ChevronUpIcon size={14} />
            </Show>
          </button>
          <button
            class="sidebar-action-btn"
            title="Hide categories sidebar (Ctrl+B)"
            onClick={props.onClose}
          >
            <XIcon size={13} />
          </button>
        </div>
      </div>

      {/* Quick Search within Categories */}
      <Show when={categoryGroups().length > 4}>
        <div class="category-filter-box">
          <SearchIcon size={12} class="category-filter-icon" />
          <input
            type="text"
            class="category-filter-input"
            placeholder="Filter categories… (Esc)"
            value={filterText()}
            onInput={(e) => setFilterText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setFilterText('')
              }
            }}
          />
          <Show when={filterText()}>
            <button
              class="category-filter-clear"
              onClick={() => setFilterText('')}
              title="Clear filter (Esc)"
            >
              <XIcon size={11} />
            </button>
          </Show>
        </div>
      </Show>

      {/* Root "All Sounds" Item */}
      <div class="category-sidebar-list">
        <div
          class="category-accordion-item all-sounds-item"
          classList={{ active: isAllSoundsActive() }}
          onClick={props.onClear}
          title={`Show all ${props.totalSounds} sounds`}
        >
          <div class="accordion-item-inner">
            <div class="accordion-chevron-slot">
              <LayersIcon size={14} class="category-item-icon" />
            </div>
            <span class="accordion-name">All Sounds</span>
            <span class="accordion-count tabular">{props.totalSounds}</span>
          </div>
        </div>

        {/* Categories Accordion */}
        <For
          each={filteredGroups()}
          fallback={
            <div class="category-empty-state">
              <span>No categories match "{filterText()}"</span>
            </div>
          }
        >
          {(group) => {
            const isCategoryActive = () => props.selectedCategory === group.category
            const isExpanded = () => expanded().has(group.category)

            return (
              <div
                class="category-accordion-item"
                classList={{
                  'category-active': isCategoryActive() && !props.selectedSubcategory,
                  'has-active-child': isCategoryActive() && Boolean(props.selectedSubcategory)
                }}
              >
                {/* Category Header Row */}
                <div
                  class="accordion-header"
                  onClick={() => handleCategoryClick(group.category)}
                  onDblClick={(e) => handleCategoryDblClick(group.category, e)}
                  title={`Filter by ${group.category} (${group.totalCount} sounds) - Double click to toggle`}
                >
                  <Show
                    when={group.subcategories.length > 0}
                    fallback={<div class="accordion-chevron-slot" />}
                  >
                    <button
                      type="button"
                      class="accordion-chevron-btn"
                      classList={{ expanded: isExpanded() }}
                      onClick={(e) => toggleExpand(group.category, e)}
                      title={isExpanded() ? 'Collapse subcategories' : 'Expand subcategories'}
                    >
                      <ChevronRightIcon size={13} />
                    </button>
                  </Show>

                  {getCategoryIcon(group.category)}
                  <span class="accordion-name">{group.category}</span>
                  <span class="accordion-count tabular">{group.totalCount}</span>
                </div>

                {/* Subcategories Accordion Content */}
                <Show when={isExpanded() && group.subcategories.length > 0}>
                  <div class="accordion-body">
                    <For each={group.subcategories}>
                      {(sub) => {
                        const isSubActive = () =>
                          isCategoryActive() && props.selectedSubcategory === sub.subcategory

                        return (
                          <div
                            class="subcategory-row"
                            classList={{ active: isSubActive() }}
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
                            <span class="subcategory-dot" />
                            <span class="subcategory-name">{sub.subcategory}</span>
                            <span class="subcategory-count tabular">{sub.count}</span>
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
        class="sidebar-resize-handle"
        onMouseDown={onResizeMouseDown}
        title="Drag to resize sidebar"
      />
    </aside>
  )
}

