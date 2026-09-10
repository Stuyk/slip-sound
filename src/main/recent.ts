import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

interface RecentEntry {
  folder: string
  openedAt: number
}

function storePath(): string {
  return join(app.getPath('userData'), 'recent-folders.json')
}

function load(): RecentEntry[] {
  const p = storePath()
  if (!existsSync(p)) return []
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return []
  }
}

function save(entries: RecentEntry[]): void {
  writeFileSync(storePath(), JSON.stringify(entries, null, 2))
}

export function getRecentFolders(): RecentEntry[] {
  return load().sort((a, b) => b.openedAt - a.openedAt)
}

export function addRecentFolder(folder: string): void {
  const entries = load().filter((e) => e.folder !== folder)
  entries.push({ folder, openedAt: Date.now() })
  save(entries.slice(-20))
}

export function removeRecentFolder(folder: string): void {
  save(load().filter((e) => e.folder !== folder))
}
