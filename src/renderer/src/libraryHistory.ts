// Undo/redo for edits to the library: categories and favorites. Each entry keeps
// the affected sounds' state from before and after the edit.
import { createSignal } from 'solid-js'
import type { SoundState } from '../../preload/index'

interface Entry {
  label: string
  before: SoundState[]
  after: SoundState[]
}

const LIMIT = 100
const [undoStack, setUndoStack] = createSignal<Entry[]>([])
const [redoStack, setRedoStack] = createSignal<Entry[]>([])

export const undoLabel = (): string | null => undoStack().at(-1)?.label ?? null
export const redoLabel = (): string | null => redoStack().at(-1)?.label ?? null

// Runs an edit and records it. Returns the new state of the affected sounds.
export async function recordEdit(
  label: string,
  paths: string[],
  apply: () => Promise<unknown>
): Promise<SoundState[]> {
  const before = await window.api.getSoundStates(paths)
  await apply()
  const after = await window.api.getSoundStates(paths)
  setUndoStack((s) => [...s, { label, before, after }].slice(-LIMIT))
  setRedoStack([])
  return after
}

// Restores the last edit's "before" state. Returns what was restored, or null.
export async function undo(): Promise<{ label: string; states: SoundState[] } | null> {
  const entry = undoStack().at(-1)
  if (!entry) return null
  await window.api.restoreSoundStates(entry.before)
  setUndoStack((s) => s.slice(0, -1))
  setRedoStack((s) => [...s, entry])
  return { label: entry.label, states: entry.before }
}

export async function redo(): Promise<{ label: string; states: SoundState[] } | null> {
  const entry = redoStack().at(-1)
  if (!entry) return null
  await window.api.restoreSoundStates(entry.after)
  setRedoStack((s) => s.slice(0, -1))
  setUndoStack((s) => [...s, entry])
  return { label: entry.label, states: entry.after }
}

// History belongs to one library.
export function clearHistory(): void {
  setUndoStack([])
  setRedoStack([])
}
