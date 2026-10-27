import { For, JSX, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import type { FolderNode } from '../../../shared/folders'
import { filterFolderTree } from '../../../shared/folders'
import { ChevronRightIcon, FolderIcon, FolderOpenIcon, LayersIcon } from './icons'

const EXPANDED_PREFIX = 'slipsound:folders-expanded:'

function loadExpanded(root: string): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_PREFIX + root)
    const arr = raw ? JSON.parse(raw) : null
    if (Array.isArray(arr)) return new Set(arr)
  } catch {
    // fallback
  }
  return new Set()
}

function saveExpanded(root: string, expanded: Set<string>): void {
  try {
    localStorage.setItem(EXPANDED_PREFIX + root, JSON.stringify([...expanded]))
  } catch {
    // ignore
  }
}

export interface FolderTreeApi {
  isAllExpanded: () => boolean
  toggleAll: () => void
}

// The library's real folder hierarchy. Selecting a folder filters the list to it
// and everything under it; search still applies inside it.
export function FolderTree(props: {
  tree: FolderNode
  selected: string
  filter: string
  onSelect: (path: string) => void
  onApi?: (api: FolderTreeApi) => void
}): JSX.Element {
  const [expanded, setExpanded] = createSignal<Set<string>>(loadExpanded(props.tree.path))

  // A different library brings its own remembered state.
  createEffect(
    on(
      () => props.tree.path,
      (root) => setExpanded(loadExpanded(root)),
      { defer: true }
    )
  )

  function update(next: Set<string>): void {
    setExpanded(next)
    if (!props.filter.trim()) saveExpanded(props.tree.path, next)
  }

  function toggle(path: string, e?: MouseEvent): void {
    e?.stopPropagation()
    const next = new Set(expanded())
    if (next.has(path)) next.delete(path)
    else next.add(path)
    update(next)
  }

  const filtered = createMemo(() =>
    props.filter.trim() ? filterFolderTree(props.tree, props.filter) : null
  )
  const isOpen = (path: string): boolean => filtered()?.expand.has(path) || expanded().has(path)
  const isVisible = (path: string): boolean => !filtered() || filtered()!.visible.has(path)

  // Expand/collapse all applies to the top level, the useful overview.
  const topLevel = (): string[] =>
    props.tree.children.filter((c) => c.children.length > 0).map((c) => c.path)
  const isAllExpanded = (): boolean =>
    topLevel().length > 0 && topLevel().every((p) => expanded().has(p))
  props.onApi?.({
    isAllExpanded,
    toggleAll: () => update(isAllExpanded() ? new Set() : new Set([...expanded(), ...topLevel()]))
  })

  // Keep the selected folder visible: open its ancestors when it's chosen.
  createEffect(
    on(
      () => props.selected,
      (sel) => {
        if (!sel) return
        const next = new Set(expanded())
        let changed = false
        const walk = (n: FolderNode): boolean => {
          if (n.path === sel) return true
          for (const c of n.children) {
            if (walk(c)) {
              if (n !== props.tree && !next.has(n.path)) {
                next.add(n.path)
                changed = true
              }
              return true
            }
          }
          return false
        }
        walk(props.tree)
        if (changed) update(next)
      }
    )
  )

  function click(node: FolderNode): void {
    props.onSelect(props.selected === node.path ? '' : node.path)
  }

  const rowClass =
    'flex items-center gap-1 h-8 min-h-[32px] pr-2 rounded-[3px] cursor-pointer text-md transition-colors'

  const Node = (p: { node: FolderNode; depth: number }): JSX.Element => {
    const active = (): boolean => props.selected === p.node.path
    const open = (): boolean => isOpen(p.node.path)
    const hasChildren = p.node.children.length > 0
    return (
      <Show when={isVisible(p.node.path)}>
        <div
          class={rowClass}
          classList={{
            'bg-[#007acc] text-white font-medium shadow-xs': active(),
            'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]': !active()
          }}
          style={{ 'padding-left': `${4 + p.depth * 14}px` }}
          onClick={() => click(p.node)}
          onDblClick={(e) => hasChildren && toggle(p.node.path, e)}
          title={`${p.node.path} (${p.node.count} sounds)${hasChildren ? ' - Double click to toggle' : ''}`}
          data-folder={p.node.path}
        >
          <Show when={hasChildren} fallback={<div class="w-6 h-6 min-w-[24px] shrink-0" />}>
            <button
              type="button"
              class="w-6 h-6 min-w-[24px] flex items-center justify-center rounded text-current opacity-70 hover:opacity-100 hover:bg-white/10 transition-all cursor-pointer"
              classList={{ 'rotate-90': open() }}
              onClick={(e) => toggle(p.node.path, e)}
              title={open() ? 'Collapse' : 'Expand'}
            >
              <ChevronRightIcon size={13} />
            </button>
          </Show>
          <Show
            when={open() && hasChildren}
            fallback={
              <FolderIcon
                size={13}
                class={`shrink-0 ${active() ? 'text-white' : 'text-[#007acc]'}`}
              />
            }
          >
            <FolderOpenIcon
              size={13}
              class={`shrink-0 ${active() ? 'text-white' : 'text-[#007acc]'}`}
            />
          </Show>
          <span class="truncate flex-1 ml-1">{p.node.name}</span>
          <span class="font-mono text-md opacity-75 tabular-nums ml-1">{p.node.count}</span>
        </div>
        <Show when={open() && hasChildren}>
          <For each={p.node.children}>{(c) => <Node node={c} depth={p.depth + 1} />}</For>
        </Show>
      </Show>
    )
  }

  const rootActive = (): boolean => !props.selected

  return (
    <div id="folder-tree" class="flex flex-col gap-0.5 mx-1.5">
      <div
        id="folder-item-all-sounds"
        class="flex items-center justify-between px-2.5 h-8 min-h-[32px] rounded-[3px] cursor-pointer text-md transition-colors"
        classList={{
          'bg-[#007acc] text-white font-medium shadow-xs': rootActive(),
          'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]': !rootActive()
        }}
        onClick={() => props.onSelect('')}
        title={props.tree.path}
      >
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <div class="w-4 h-4 flex items-center justify-center shrink-0">
            <LayersIcon size={14} class={rootActive() ? 'text-white' : 'text-[#007acc]'} />
          </div>
          <span class="truncate flex-1">All Sounds</span>
          <span class="font-mono text-md opacity-75 tabular-nums">{props.tree.count}</span>
        </div>
      </div>
      <For
        each={props.tree.children}
        fallback={
          <div class="p-4 text-center text-md text-[#8b949e]">
            All sounds are in the top folder.
          </div>
        }
      >
        {(c) => <Node node={c} depth={0} />}
      </For>
      <Show when={filtered() && filtered()!.visible.size === 0}>
        <div id="folder-tree-empty" class="p-4 text-center text-md text-[#8b949e]">
          No folders match "{props.filter}"
        </div>
      </Show>
    </div>
  )
}
