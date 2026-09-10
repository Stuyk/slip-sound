import { readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import { DatabaseSync } from 'node:sqlite'
import { pruneMissingSounds, insertSounds, InsertableSound } from './db'
import { readAudioMeta } from './audioMeta'
import { DB_FILENAME } from './db'
import { classifySound } from './classifier'

const AUDIO_EXTS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.aiff', '.aif', '.m4a'])

function walk(dir: string, out: string[]): void {
  let entries: import('fs').Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name === DB_FILENAME || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (entry.isFile() && AUDIO_EXTS.has(extname(entry.name).toLowerCase())) {
      out.push(full)
    }
  }
}

export interface ReindexResult {
  fileCount: number
  durationMs: number
}

export function reindexFolder(
  db: DatabaseSync,
  folder: string,
  onProgress?: (done: number, total: number) => void
): ReindexResult {
  const start = Date.now()
  const files: string[] = []
  walk(folder, files)

  const rows: InsertableSound[] = []
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]
    const stat = statSync(filePath)
    const meta = readAudioMeta(filePath)
    const classification = classifySound(filePath)
    rows.push({
      path: filePath,
      // path.basename handles both '/' and '\' correctly per-platform — a
      // hand-rolled lastIndexOf('/') split silently broke on Windows paths
      // (backslash-separated), making every indexed "filename" the full
      // absolute path instead of just the leaf name.
      filename: basename(filePath),
      duration: meta.duration,
      channels: meta.channels,
      sample_rate: meta.sampleRate,
      filesize: stat.size,
      category: classification.category,
      subcategory: classification.subcategory ?? null,
      confidence: classification.confidence,
      matched_terms: classification.matchedTerms
    })
    if (onProgress && (i % 500 === 0 || i === files.length - 1)) {
      onProgress(i + 1, files.length)
    }
  }

  insertSounds(db, rows)
  pruneMissingSounds(db, files)

  return { fileCount: files.length, durationMs: Date.now() - start }
}
