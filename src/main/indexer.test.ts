import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, searchSounds } from './db'
import { reindexFolder } from './indexer'

const folders: string[] = []

function libraryWithKick(): string {
  const folder = mkdtempSync(join(tmpdir(), 'slip-sound-indexer-'))
  folders.push(folder)
  writeFileSync(join(folder, 'kick.wav'), Buffer.alloc(44))
  return folder
}

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

describe('reindexFolder automatic categorization setting', () => {
  it('automatically categorizes by default to preserve existing behavior', () => {
    const folder = libraryWithKick()
    const db = openDatabase(folder)

    reindexFolder(db, folder)

    expect(searchSounds(db, { query: '' })[0].category).not.toBe('Uncategorized')
    db.close()
  })

  it('leaves sounds uncategorized when automatic categorization is disabled', () => {
    const folder = libraryWithKick()
    const db = openDatabase(folder)

    reindexFolder(db, folder, undefined, false)

    const sound = searchSounds(db, { query: '' })[0]
    expect(sound.category).toBe('Uncategorized')
    expect(sound.confidence).toBe(0)
    expect(sound.matched_terms).toEqual([])
    db.close()
  })
})
