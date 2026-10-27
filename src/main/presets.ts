// User processing presets, stored in userData so they survive cache clears.
// Built-in presets live in src/shared/processing.ts and are never written here.
import { app } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  BUILTIN_PRESETS,
  DEFAULT_PROCESSING,
  type ProcessingEffects,
  type ProcessingPreset,
  effectsOf,
  normalizeSettings
} from '../shared/processing'

interface PresetFile {
  version: 1
  presets: ProcessingPreset[]
}

function storePath(): string {
  return join(app.getPath('userData'), 'processing-presets.json')
}

// Coerces untrusted JSON (our file, or an imported one) into valid presets.
export function sanitizePresets(raw: unknown): ProcessingPreset[] {
  const list = Array.isArray((raw as PresetFile)?.presets)
    ? (raw as PresetFile).presets
    : Array.isArray(raw)
      ? raw
      : []
  const out: ProcessingPreset[] = []
  for (const p of list as Array<Partial<ProcessingPreset>>) {
    if (!p || typeof p.name !== 'string' || !p.name.trim() || typeof p.settings !== 'object')
      continue
    const settings = effectsOf(normalizeSettings({ ...DEFAULT_PROCESSING, ...p.settings }))
    out.push({
      id: typeof p.id === 'string' && p.id.startsWith('user:') ? p.id : `user:${randomUUID()}`,
      name: p.name.trim().slice(0, 80),
      settings
    })
  }
  return out
}

function loadUser(): ProcessingPreset[] {
  const p = storePath()
  if (!existsSync(p)) return []
  try {
    return sanitizePresets(JSON.parse(readFileSync(p, 'utf-8')))
  } catch {
    return []
  }
}

function saveUser(presets: ProcessingPreset[]): void {
  const file: PresetFile = { version: 1, presets }
  writeFileSync(storePath(), JSON.stringify(file, null, 2))
}

export function listPresets(): ProcessingPreset[] {
  return [...BUILTIN_PRESETS, ...loadUser()]
}

// Creates a preset, or updates one when `id` names an existing user preset.
export function savePreset(input: {
  id?: string
  name: string
  settings: ProcessingEffects
}): ProcessingPreset {
  const [clean] = sanitizePresets({ presets: [{ ...input, id: input.id ?? '' }] })
  if (!clean) throw new Error('Preset needs a name')
  const user = loadUser()
  const idx = input.id ? user.findIndex((p) => p.id === input.id) : -1
  if (idx >= 0) user[idx] = { ...clean, id: user[idx].id }
  else user.push(clean)
  saveUser(user)
  return idx >= 0 ? user[idx] : clean
}

export function deletePreset(id: string): void {
  saveUser(loadUser().filter((p) => p.id !== id))
}

export function exportPresets(filePath: string): number {
  const user = loadUser()
  writeFileSync(
    filePath,
    JSON.stringify({ version: 1, presets: user } satisfies PresetFile, null, 2)
  )
  return user.length
}

// Adds presets from a shared file; clashing names get a " (2)" style suffix.
export function importPresets(filePath: string): number {
  const incoming = sanitizePresets(JSON.parse(readFileSync(filePath, 'utf-8')))
  const user = loadUser()
  const names = new Set([...BUILTIN_PRESETS, ...user].map((p) => p.name.toLowerCase()))
  for (const p of incoming) {
    let name = p.name
    for (let i = 2; names.has(name.toLowerCase()); i++) name = `${p.name} (${i})`
    names.add(name.toLowerCase())
    user.push({ ...p, id: `user:${randomUUID()}`, name })
  }
  saveUser(user)
  return incoming.length
}
