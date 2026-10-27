import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { DB_FILENAME, countMatchingSounds, getFolderTree, openDatabase, searchSounds } from './db'
import { reindexFolder } from './indexer'

let folder: string
let db: DatabaseSync

beforeAll(() => {
  folder = mkdtempSync(join(tmpdir(), 'slip-sound-folders-'))
  for (const rel of [
    'Foley/Cloth/cloth rustle.wav',
    'Foley/door slam.wav',
    'Foley2/door creak.wav',
    'Whooshes/whoosh fast.wav',
    'Ambiences/Rain/0002_Squeaky_Door_Close.wav',
    'door knock.wav'
  ]) {
    const file = join(folder, rel)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, Buffer.alloc(44))
  }
  db = openDatabase(folder)
  reindexFolder(db, folder)
})

afterAll(() => {
  db.close()
  rmSync(folder, { recursive: true, force: true })
})

const names = (rows: { filename: string }[]): string[] => rows.map((r) => r.filename).sort()

describe('folder filter', () => {
  it('limits results to the folder and its subfolders', () => {
    const rows = searchSounds(db, { query: '', folder: join(folder, 'Foley') })
    expect(names(rows)).toEqual(['cloth rustle.wav', 'door slam.wav'])
    expect(countMatchingSounds(db, { query: '', folder: join(folder, 'Foley') })).toBe(2)
  })

  it('combines with text search', () => {
    const params = { query: 'door', folder: join(folder, 'Foley') }
    expect(names(searchSounds(db, params))).toEqual(['door slam.wav'])
    expect(countMatchingSounds(db, params)).toBe(1)
    expect(countMatchingSounds(db, { query: 'door' })).toBe(4)
  })
})

describe('getFolderTree', () => {
  it('lists folders with recursive counts', () => {
    const tree = getFolderTree(db, folder)
    expect(tree.count).toBe(6)
    expect(tree.children.map((c) => [c.name, c.count])).toEqual([
      ['Ambiences', 1],
      ['Foley', 2],
      ['Foley2', 1],
      ['Whooshes', 1]
    ])
    expect(tree.children[1].children.map((c) => c.name)).toEqual(['Cloth'])
  })
})

describe('search words', () => {
  const found = (query: string): string[] => names(searchSounds(db, { query }))

  it('matches words inside underscore and dash separated names', () => {
    expect(found('squeaky')).toEqual(['0002_Squeaky_Door_Close.wav'])
    expect(found('clo')).toEqual(['0002_Squeaky_Door_Close.wav', 'cloth rustle.wav'])
  })

  it('matches every word in any order', () => {
    expect(found('door squeaky')).toEqual(['0002_Squeaky_Door_Close.wav'])
    expect(found('squeaky door')).toEqual(['0002_Squeaky_Door_Close.wav'])
    expect(found('door whoosh')).toEqual([])
  })

  it('matches folder names', () => {
    expect(found('rain')).toEqual(['0002_Squeaky_Door_Close.wav'])
    expect(found('whooshes')).toEqual(['whoosh fast.wav'])
  })

  it('treats punctuation-only queries as no search', () => {
    expect(countMatchingSounds(db, { query: '__ "' })).toBe(6)
  })
})

describe('upgrading an existing library database', () => {
  it('backfills folders and rebuilds the search index', () => {
    const root = mkdtempSync(join(tmpdir(), 'slip-sound-migrate-'))
    try {
      const old = new DatabaseSync(join(root, DB_FILENAME))
      old.exec(`
        CREATE TABLE sounds (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT UNIQUE NOT NULL,
          filename TEXT NOT NULL, duration REAL, channels INTEGER, sample_rate INTEGER, filesize INTEGER,
          category TEXT NOT NULL DEFAULT 'Uncategorized', subcategory TEXT, confidence REAL NOT NULL DEFAULT 0,
          matched_terms TEXT, favorite INTEGER NOT NULL DEFAULT 0, category_manual INTEGER NOT NULL DEFAULT 0);
        CREATE VIRTUAL TABLE sounds_fts USING fts5(filename, category, subcategory, content='sounds',
          content_rowid='id', tokenize = "unicode61 tokenchars '_-.'");
        CREATE TRIGGER sounds_ai AFTER INSERT ON sounds BEGIN
          INSERT INTO sounds_fts(rowid, filename, category, subcategory)
          VALUES (new.id, new.filename, new.category, new.subcategory);
        END;
        CREATE TRIGGER sounds_au AFTER UPDATE ON sounds BEGIN
          INSERT INTO sounds_fts(sounds_fts, rowid, filename, category, subcategory)
          VALUES ('delete', old.id, old.filename, old.category, old.subcategory);
          INSERT INTO sounds_fts(rowid, filename, category, subcategory)
          VALUES (new.id, new.filename, new.category, new.subcategory);
        END;
      `)
      old
        .prepare('INSERT INTO sounds (path, filename, favorite) VALUES (?, ?, 1)')
        .run(join(root, 'Rain', 'Heavy', 'big_Storm_01.wav'), 'big_Storm_01.wav')
      old.close()

      const upgraded = openDatabase(root)
      const params = { query: 'heavy storm' }
      expect(countMatchingSounds(upgraded, params)).toBe(1)
      const [row] = searchSounds(upgraded, params)
      expect(row.favorite).toBe(true)
      const folderCol = upgraded.prepare('SELECT folder FROM sounds').get() as { folder: string }
      expect(folderCol.folder).toBe(join('Rain', 'Heavy'))
      upgraded.close()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
