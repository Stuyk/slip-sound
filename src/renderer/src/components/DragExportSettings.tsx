import { JSX, Show, createSignal, onMount } from 'solid-js'
import { FolderInput, FolderOpen, FolderOutput, RotateCcw } from 'lucide-solid'
import type { DragFolderInfo } from '../../../preload/index'
import { Button } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'

// Settings section for the persistent drag-out folder (same controls as the
// status bar's Drag Exports menu, where people look for configuration).
export function DragExportSettings(): JSX.Element {
  const [info, setInfo] = createSignal<DragFolderInfo | null>(null)
  onMount(async () => setInfo(await window.api.getDragFolderInfo()))

  return (
    <div
      id="settings-section-drag-exports"
      class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-3"
    >
      <div class="flex items-center gap-2">
        <FolderOutput size={14} class="text-[var(--accent-color)] shrink-0" />
        <div>
          <div class="font-bold text-md text-[var(--text-main)]">Drag Exports</div>
          <div class="text-md text-[var(--text-muted)]">
            Regions and Effects results you drag out are saved here, so editors like Resolve never
            show them as offline.
          </div>
        </div>
      </div>
      <Show when={info()}>
        {(i) => (
          <>
            <div class="flex items-center justify-between gap-3">
              <span
                id="settings-drag-folder"
                class="font-mono text-[var(--text-main)] truncate"
                title={i().folder}
              >
                {i().folder}
              </span>
              <span class="text-[var(--text-muted)] whitespace-nowrap">
                {i().count} file{i().count === 1 ? '' : 's'}
              </span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-[var(--text-muted)]">WAV format</span>
              <SegmentedControl
                id="settings-drag-bit-depth"
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
            <div class="flex items-center gap-2">
              <Button
                size="sm"
                icon={<FolderOpen size={13} />}
                onClick={() => void window.api.openDragFolder()}
              >
                Open
              </Button>
              <Button
                size="sm"
                icon={<FolderInput size={13} />}
                onClick={async () => setInfo(await window.api.chooseDragFolder())}
              >
                Change…
              </Button>
              <Show when={!i().isDefault}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<RotateCcw size={13} />}
                  onClick={async () => setInfo(await window.api.resetDragFolder())}
                >
                  Reset to default
                </Button>
              </Show>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}
