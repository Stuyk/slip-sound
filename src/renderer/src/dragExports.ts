// Drag-out of rendered files (regions, Effects results). The files live in the
// persistent Drag Exports folder; the first drag each session says so, because
// otherwise nobody knows the folder exists.
import { showToast } from './components/ui/Toast'

let toldThisSession = false

export function startRenderedDrag(items: Array<{ path: string; name: string }>): void {
  if (items.length === 0) return
  window.api.startDragRendered(items)
  if (toldThisSession) return
  toldThisSession = true
  // Shown after the drag so it doesn't get in the way of the drop.
  setTimeout(async () => {
    const info = await window.api.getDragFolderInfo()
    showToast({
      type: 'info',
      title:
        items.length === 1
          ? 'Copy saved to Drag Exports'
          : `${items.length} copies saved to Drag Exports`,
      message: `${info.folder}. Your editor keeps working even after the drag. Manage it from Drag Exports in the status bar or Settings.`,
      action: { label: 'Show folder', onClick: () => void window.api.openDragFolder() }
    })
  }, 600)
}
