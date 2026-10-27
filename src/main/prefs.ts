import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

interface Prefs {
  lastExportFolder?: string
  mcpEnabled?: boolean
  autoCategorizationEnabled?: boolean
  dragExportFolder?: string
  dragBitDepth?: 16 | 24 | 32
}

function storePath(): string {
  return join(app.getPath('userData'), 'prefs.json')
}

function load(): Prefs {
  const p = storePath()
  if (!existsSync(p)) return {}
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return {}
  }
}

function save(prefs: Prefs): void {
  writeFileSync(storePath(), JSON.stringify(prefs, null, 2))
}

export function getLastExportFolder(): string | undefined {
  return load().lastExportFolder
}

export function setLastExportFolder(folder: string): void {
  const prefs = load()
  prefs.lastExportFolder = folder
  save(prefs)
}

// Defaults to OFF — a local HTTP server that lets external tools read/write
// your library shouldn't just turn itself on without the user opting in
// from Settings first.
export function getMcpEnabled(): boolean {
  return load().mcpEnabled === true
}

export function setMcpEnabled(enabled: boolean): void {
  const prefs = load()
  prefs.mcpEnabled = enabled
  save(prefs)
}

// Keep the existing indexing behavior unless the user explicitly opts out.
export function getAutoCategorizationEnabled(): boolean {
  return load().autoCategorizationEnabled !== false
}

export function setAutoCategorizationEnabled(enabled: boolean): void {
  const prefs = load()
  prefs.autoCategorizationEnabled = enabled
  save(prefs)
}

// Where dragged-out renders are kept. Unset = the per-user default folder.
export function getDragExportFolderPref(): string | undefined {
  return load().dragExportFolder
}

export function setDragExportFolderPref(folder: string | undefined): void {
  const prefs = load()
  prefs.dragExportFolder = folder
  save(prefs)
}

// 24-bit by default so dragging a region out never downgrades a 24-bit source.
export function getDragBitDepth(): 16 | 24 | 32 {
  const v = load().dragBitDepth
  return v === 16 || v === 32 ? v : 24
}

export function setDragBitDepth(bits: 16 | 24 | 32): void {
  const prefs = load()
  prefs.dragBitDepth = bits
  save(prefs)
}
