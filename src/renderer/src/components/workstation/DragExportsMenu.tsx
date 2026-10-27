import { For, JSX, Show, createSignal, onCleanup, onMount } from 'solid-js'
import {
  ChevronUp,
  Copy,
  FolderOpen,
  FolderInput,
  RotateCcw,
  Trash2,
  FileAudio
} from 'lucide-solid'
import type { DragFolderInfo } from '../../../../preload/index'
import { SegmentedControl } from '../ui/SegmentedControl'
import { showToast } from '../ui/Toast'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function timeAgo(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// Status-bar dropdown for the persistent drag-out folder: where files went,
// recent drags, format, and housekeeping (specs/processing.md §6.6).
export function DragExportsMenu(): JSX.Element {
  const [open, setOpen] = createSignal(false)
  const [info, setInfo] = createSignal<DragFolderInfo | null>(null)
  let root: HTMLDivElement | undefined

  async function refresh(): Promise<void> {
    setInfo(await window.api.getDragFolderInfo())
  }

  async function toggle(): Promise<void> {
    const next = !open()
    setOpen(next)
    if (next) await refresh()
  }

  const onDocDown = (e: MouseEvent): void => {
    if (open() && root && !root.contains(e.target as Node)) setOpen(false)
  }
  onMount(() => document.addEventListener('mousedown', onDocDown))
  onCleanup(() => document.removeEventListener('mousedown', onDocDown))

  async function clearFolder(): Promise<void> {
    const i = info()
    if (!i || i.count === 0) return
    const ok = window.confirm(
      `Move ${i.count} file${i.count === 1 ? '' : 's'} (${formatBytes(i.bytes)}) from the drag folder to the trash?\n\n` +
        'Editing projects that use these files will show them as offline.'
    )
    if (!ok) return
    const res = await window.api.clearDragFolder()
    setInfo(res.info)
    showToast({
      type: 'success',
      title: `Moved ${res.removed} file${res.removed === 1 ? '' : 's'} to the trash`
    })
  }

  const itemClass =
    'w-full px-3 py-1.5 flex items-center gap-2 text-left text-[#f0f3f6] hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer'

  return (
    <div class="relative" ref={root}>
      <button
        id="status-bar-drag-exports-btn"
        type="button"
        class="h-7 min-h-[28px] px-2.5 rounded-[3px] border text-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer bg-[#1e2022] border-[#1c1d1f] text-[#8b949e] hover:text-[#f0f3f6] hover:bg-[#32353a]"
        classList={{ 'text-[#f0f3f6] bg-[#32353a]': open() }}
        onClick={() => void toggle()}
        title="Where dragged-out sounds are saved"
      >
        <FolderOpen size={12} />
        <span>Drag Exports</span>
        <ChevronUp size={12} class={`transition-transform ${open() ? '' : 'rotate-180'}`} />
      </button>

      <Show when={open() && info()}>
        {(i) => (
          <div
            id="drag-exports-menu"
            class="absolute right-0 bottom-full mb-1.5 w-[420px] bg-[#26282b] border border-[#1c1d1f] rounded-[3px] shadow-2xl z-50 py-1.5 text-md text-[#f0f3f6]"
          >
            <div class="px-3 pb-2 border-b border-[#1c1d1f] flex flex-col gap-1">
              <div class="flex items-center justify-between text-[#8b949e]">
                <span>Drag export folder{i().isDefault ? ' (default)' : ''}</span>
                <span class="font-mono">
                  {i().count} files · {formatBytes(i().bytes)}
                </span>
              </div>
              <div class="font-mono text-[#f0f3f6] break-all">{i().folder}</div>
              <Show when={i().fellBack}>
                <div class="text-amber-300">
                  Your chosen folder isn't available, so the default is used for now.
                </div>
              </Show>
            </div>

            <div class="max-h-64 overflow-y-auto dcc-scroll py-1 border-b border-[#1c1d1f]">
              <Show
                when={i().recent.length > 0}
                fallback={
                  <div class="px-3 py-3 text-[#8b949e]">
                    Nothing dragged out yet. Region and processed drags are saved here so editing
                    projects never lose them.
                  </div>
                }
              >
                <For each={i().recent}>
                  {(f) => (
                    <button
                      type="button"
                      class={itemClass}
                      title={`Reveal ${f.name}`}
                      onClick={() => window.api.revealInFolder(f.path)}
                    >
                      <FileAudio size={13} class="shrink-0 opacity-70" />
                      <span class="truncate flex-1 font-mono">{f.name}</span>
                      <span class="shrink-0 font-mono opacity-60">{formatBytes(f.size)}</span>
                      <span class="shrink-0 w-16 whitespace-nowrap text-right opacity-60">
                        {timeAgo(f.mtimeMs)}
                      </span>
                    </button>
                  )}
                </For>
              </Show>
            </div>

            <div class="px-3 py-2 flex items-center justify-between border-b border-[#1c1d1f]">
              <span class="text-[#8b949e]">Drag format (WAV)</span>
              <SegmentedControl
                id="drag-bit-depth"
                size="xs"
                value={String(i().bitDepth)}
                onChange={async (v) =>
                  setInfo(await window.api.setDragBitDepth(parseInt(v, 10) as 16 | 24 | 32))
                }
                items={[
                  { id: '16', label: '16-bit' },
                  { id: '24', label: '24-bit' },
                  { id: '32', label: '32f' }
                ]}
              />
            </div>

            <div class="pt-1">
              <button
                type="button"
                class={itemClass}
                onClick={() => void window.api.openDragFolder()}
              >
                <FolderOpen size={13} /> Open folder
              </button>
              <button
                type="button"
                class={itemClass}
                onClick={() => {
                  void navigator.clipboard.writeText(i().folder)
                  showToast({ type: 'success', title: 'Folder path copied' })
                }}
              >
                <Copy size={13} /> Copy path
              </button>
              <button
                type="button"
                class={itemClass}
                onClick={async () => setInfo(await window.api.chooseDragFolder())}
              >
                <FolderInput size={13} /> Change folder…
              </button>
              <Show when={!i().isDefault}>
                <button
                  type="button"
                  class={itemClass}
                  onClick={async () => setInfo(await window.api.resetDragFolder())}
                >
                  <RotateCcw size={13} /> Reset to default
                </button>
              </Show>
              <button
                type="button"
                class={`${itemClass} text-red-300`}
                disabled={i().count === 0}
                onClick={() => void clearFolder()}
              >
                <Trash2 size={13} /> Clear folder…
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
