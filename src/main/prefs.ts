import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

interface Prefs {
  lastExportFolder?: string
  mcpEnabled?: boolean
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
