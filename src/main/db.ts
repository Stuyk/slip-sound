import { DatabaseSync } from 'node:sqlite'
import { join } from 'path'

export const DB_FILENAME = 'slip-sound.db'

export interface SoundRow {
  id: number
  path: string
  filename: string
  duration: number | null
  channels: number | null
  sample_rate: number | null
  filesize: number | null
  category: string
  subcategory: string | null
  confidence: number
  matched_terms: string[]
  favorite: boolean
  category_manual: boolean
}

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS sounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    duration REAL,
    channels INTEGER,
    sample_rate INTEGER,
    filesize INTEGER,
    category TEXT NOT NULL DEFAULT 'Uncategorized',
    subcategory TEXT,
    confidence REAL NOT NULL DEFAULT 0,
    matched_terms TEXT,
    favorite INTEGER NOT NULL DEFAULT 0,
    category_manual INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_duration ON sounds(duration);
CREATE INDEX IF NOT EXISTS idx_channels ON sounds(channels);
`

// These reference columns that may not exist yet on a pre-v2 database, so
// they're created only after migrateIfNeeded has ensured the columns exist —
// never as part of BASE_SCHEMA, which must stay safe to run against an old table.
const CATEGORY_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_category ON sounds(category);
CREATE INDEX IF NOT EXISTS idx_category_subcategory ON sounds(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_confidence ON sounds(confidence);
`

// Same rationale as CATEGORY_INDEXES: references a column that may not
// exist yet on an older database, so it's applied only after migration.
const FAVORITE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_favorite ON sounds(favorite);
`

const FTS_COLUMNS = ['filename', 'category', 'subcategory']

function createFtsAndTriggers(db: DatabaseSync): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS sounds_fts USING fts5(
        filename,
        category,
        subcategory,
        content='sounds',
        content_rowid='id',
        tokenize = "unicode61 tokenchars '_-.'"
    );

    CREATE TRIGGER IF NOT EXISTS sounds_ai AFTER INSERT ON sounds BEGIN
      INSERT INTO sounds_fts(rowid, filename, category, subcategory)
      VALUES (new.id, new.filename, new.category, new.subcategory);
    END;

    CREATE TRIGGER IF NOT EXISTS sounds_ad AFTER DELETE ON sounds BEGIN
      INSERT INTO sounds_fts(sounds_fts, rowid, filename, category, subcategory)
      VALUES ('delete', old.id, old.filename, old.category, old.subcategory);
    END;

    CREATE TRIGGER IF NOT EXISTS sounds_au AFTER UPDATE ON sounds BEGIN
      INSERT INTO sounds_fts(sounds_fts, rowid, filename, category, subcategory)
      VALUES ('delete', old.id, old.filename, old.category, old.subcategory);
      INSERT INTO sounds_fts(rowid, filename, category, subcategory)
      VALUES (new.id, new.filename, new.category, new.subcategory);
    END;
  `)
}

// Migrates a pre-v2 database (no category/subcategory/confidence columns,
// FTS indexing filename only) up to the current schema in place.
function migrateIfNeeded(db: DatabaseSync): void {
  const columns = db.prepare('PRAGMA table_info(sounds)').all() as { name: string }[]
  const columnNames = new Set(columns.map((c) => c.name))

  const missingCategory = !columnNames.has('category')
  if (missingCategory) {
    db.exec("ALTER TABLE sounds ADD COLUMN category TEXT NOT NULL DEFAULT 'Uncategorized';")
  }
  if (!columnNames.has('subcategory')) {
    db.exec('ALTER TABLE sounds ADD COLUMN subcategory TEXT;')
  }
  if (!columnNames.has('confidence')) {
    db.exec('ALTER TABLE sounds ADD COLUMN confidence REAL NOT NULL DEFAULT 0;')
  }
  if (!columnNames.has('matched_terms')) {
    db.exec('ALTER TABLE sounds ADD COLUMN matched_terms TEXT;')
  }
  if (!columnNames.has('favorite')) {
    db.exec('ALTER TABLE sounds ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;')
  }
  if (!columnNames.has('category_manual')) {
    db.exec('ALTER TABLE sounds ADD COLUMN category_manual INTEGER NOT NULL DEFAULT 0;')
  }

  db.exec(CATEGORY_INDEXES)
  db.exec(FAVORITE_INDEX)

  // Check whether the existing FTS table already has the category/subcategory
  // columns; if not (old schema, or didn't exist yet), rebuild it.
  const ftsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'sounds_fts'").get() as
    | { sql: string }
    | undefined
  const ftsNeedsRebuild = !ftsInfo || !FTS_COLUMNS.every((col) => ftsInfo.sql.includes(col))

  if (ftsNeedsRebuild) {
    db.exec('DROP TRIGGER IF EXISTS sounds_ai;')
    db.exec('DROP TRIGGER IF EXISTS sounds_ad;')
    db.exec('DROP TRIGGER IF EXISTS sounds_au;')
    db.exec('DROP TABLE IF EXISTS sounds_fts;')
    createFtsAndTriggers(db)
    db.exec("INSERT INTO sounds_fts(sounds_fts) VALUES ('rebuild');")
  }
}

export function dbPathForFolder(folder: string): string {
  return join(folder, DB_FILENAME)
}

export function openDatabase(folder: string): DatabaseSync {
  const db = new DatabaseSync(dbPathForFolder(folder))
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec(BASE_SCHEMA)
  createFtsAndTriggers(db)
  migrateIfNeeded(db)
  return db
}

// Removes rows for files that no longer exist on disk — call after a reindex
// with the full set of paths seen on that pass. Deliberately NOT a blind
// "delete everything then reinsert": insertSounds() upserts existing rows in
// place (preserving favorite), so this only clears out genuinely missing files.
export function pruneMissingSounds(db: DatabaseSync, currentPaths: string[]): void {
  db.exec('CREATE TEMP TABLE IF NOT EXISTS _current_paths (path TEXT PRIMARY KEY);')
  db.exec('DELETE FROM _current_paths;')
  const insertPath = db.prepare('INSERT OR IGNORE INTO _current_paths (path) VALUES (?);')
  db.exec('BEGIN');
  try {
    for (const path of currentPaths) {
      insertPath.run(path)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  db.exec('DELETE FROM sounds WHERE path NOT IN (SELECT path FROM _current_paths);')
  db.exec('DROP TABLE _current_paths;')
}

export interface InsertableSound {
  path: string
  filename: string
  duration: number | null
  channels: number | null
  sample_rate: number | null
  filesize: number | null
  category: string
  subcategory: string | null
  confidence: number
  matched_terms: string[]
}

export function insertSounds(db: DatabaseSync, rows: InsertableSound[]): void {
  // favorite is deliberately absent from the UPDATE SET clause: on a re-index
  // an existing row is upserted (metadata refreshed) but its favorite flag —
  // and any other future per-file user state — survives untouched. Only a
  // brand new row gets the column default (0). category/subcategory/
  // confidence/matched_terms follow the same rule, but conditionally: if the
  // user manually assigned a category (category_manual=1), the classifier's
  // fresh guess on this reindex is discarded so their choice sticks.
  const stmt = db.prepare(
    `INSERT INTO sounds (path, filename, duration, channels, sample_rate, filesize, category, subcategory, confidence, matched_terms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       filename = excluded.filename,
       duration = excluded.duration,
       channels = excluded.channels,
       sample_rate = excluded.sample_rate,
       filesize = excluded.filesize,
       category = CASE WHEN sounds.category_manual = 1 THEN sounds.category ELSE excluded.category END,
       subcategory = CASE WHEN sounds.category_manual = 1 THEN sounds.subcategory ELSE excluded.subcategory END,
       confidence = CASE WHEN sounds.category_manual = 1 THEN sounds.confidence ELSE excluded.confidence END,
       matched_terms = CASE WHEN sounds.category_manual = 1 THEN sounds.matched_terms ELSE excluded.matched_terms END`
  )
  db.exec('BEGIN')
  try {
    for (const row of rows) {
      stmt.run(
        row.path,
        row.filename,
        row.duration,
        row.channels,
        row.sample_rate,
        row.filesize,
        row.category,
        row.subcategory,
        row.confidence,
        JSON.stringify(row.matched_terms)
      )
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export type SortColumn = 'favorite' | 'filename' | 'category' | 'duration' | 'channels' | 'sample_rate' | 'filesize'
export type SortDir = 'asc' | 'desc'

export interface SearchParams {
  query: string
  maxDuration?: number
  channels?: number
  category?: string
  subcategory?: string
  minConfidence?: number
  favoriteOnly?: boolean
  sortBy?: SortColumn
  sortDir?: SortDir
  limit?: number
  offset?: number
}

// Whitelisted so sortBy can never be interpolated into raw SQL unchecked.
const SORT_COLUMN_SQL: Record<SortColumn, string> = {
  favorite: 's.favorite',
  filename: 's.filename COLLATE NOCASE',
  category: 's.category COLLATE NOCASE',
  duration: 's.duration',
  channels: 's.channels',
  sample_rate: 's.sample_rate',
  filesize: 's.filesize'
}

function buildOrderByClause(sortBy: SortColumn | undefined, sortDir: SortDir | undefined): string {
  if (!sortBy) return ''
  const col = SORT_COLUMN_SQL[sortBy]
  if (!col) return ''
  const dir = sortDir === 'desc' ? 'DESC' : 'ASC'
  // NULLs always sort last regardless of direction — an unset duration/size
  // shouldn't jump to the top just because you sorted descending.
  return ` ORDER BY ${col} IS NULL, ${col} ${dir}, s.filename COLLATE NOCASE ASC`
}

interface SoundRowRaw {
  id: number
  path: string
  filename: string
  duration: number | null
  channels: number | null
  sample_rate: number | null
  filesize: number | null
  category: string
  subcategory: string | null
  confidence: number
  matched_terms: string | null
  favorite: number
  category_manual: number
}

function parseRow(row: SoundRowRaw): SoundRow {
  let matchedTerms: string[] = []
  if (row.matched_terms) {
    try {
      matchedTerms = JSON.parse(row.matched_terms)
    } catch {
      matchedTerms = []
    }
  }
  return {
    ...row,
    matched_terms: matchedTerms,
    favorite: row.favorite === 1,
    category_manual: row.category_manual === 1
  }
}

export function getSoundByPath(db: DatabaseSync, path: string): SoundRow | null {
  const row = db
    .prepare(
      `SELECT id, filename, path, duration, channels, sample_rate, filesize,
              category, subcategory, confidence, matched_terms, favorite, category_manual
       FROM sounds WHERE path = ?`
    )
    .get(path) as SoundRowRaw | undefined
  return row ? parseRow(row) : null
}

export function setFavorite(db: DatabaseSync, path: string, favorite: boolean): void {
  db.prepare('UPDATE sounds SET favorite = ? WHERE path = ?').run(favorite ? 1 : 0, path)
}

export function toggleFavorite(db: DatabaseSync, path: string): boolean {
  const row = db.prepare('SELECT favorite FROM sounds WHERE path = ?').get(path) as
    | { favorite: number }
    | undefined
  const next = !row?.favorite
  setFavorite(db, path, next)
  return next
}

// Manually assigns a category/subcategory to a sound, marking it so a future
// reindex's auto-classification pass won't overwrite the choice.
export function setCategory(db: DatabaseSync, path: string, category: string, subcategory: string | null): void {
  db.prepare(
    `UPDATE sounds
     SET category = ?, subcategory = ?, confidence = 1, category_manual = 1
     WHERE path = ?`
  ).run(category, subcategory, path)
}

// Reverts a sound to "Uncategorized" and clears the manual flag, so the next
// reindex is free to auto-classify it again from its filename.
export function clearCategory(db: DatabaseSync, path: string): void {
  db.prepare(
    `UPDATE sounds
     SET category = 'Uncategorized', subcategory = NULL, confidence = 0, matched_terms = NULL, category_manual = 0
     WHERE path = ?`
  ).run(path)
}

export function searchSounds(db: DatabaseSync, params: SearchParams): SoundRow[] {
  const {
    query,
    maxDuration,
    channels,
    category,
    subcategory,
    minConfidence,
    favoriteOnly,
    sortBy,
    sortDir,
    limit = 50,
    offset = 0
  } = params
  const clauses: string[] = []
  const args: unknown[] = []

  let sql: string
  if (query && query.trim().length > 0) {
    sql = `SELECT s.id, s.filename, s.path, s.duration, s.channels, s.sample_rate, s.filesize,
                  s.category, s.subcategory, s.confidence, s.matched_terms, s.favorite, s.category_manual
           FROM sounds_fts f
           JOIN sounds s ON s.id = f.rowid
           WHERE sounds_fts MATCH ?`
    args.push(ftsPrefixQuery(query))
  } else {
    sql = `SELECT id, filename, path, duration, channels, sample_rate, filesize,
                  category, subcategory, confidence, matched_terms, favorite, category_manual
           FROM sounds s`
    clauses.push('1=1')
  }

  if (maxDuration !== undefined) {
    clauses.push('s.duration IS NOT NULL AND s.duration < ?')
    args.push(maxDuration)
  }
  if (channels !== undefined) {
    clauses.push('s.channels = ?')
    args.push(channels)
  }
  if (category !== undefined) {
    clauses.push('s.category = ?')
    args.push(category)
  }
  if (subcategory !== undefined) {
    clauses.push('s.subcategory = ?')
    args.push(subcategory)
  }
  if (minConfidence !== undefined) {
    clauses.push('s.confidence >= ?')
    args.push(minConfidence)
  }
  if (favoriteOnly) {
    clauses.push('s.favorite = 1')
  }

  if (clauses.length > 0) {
    sql += (query && query.trim().length > 0 ? ' AND ' : ' WHERE ') + clauses.join(' AND ')
  }

  sql += buildOrderByClause(sortBy, sortDir)
  sql += ' LIMIT ? OFFSET ?'
  args.push(limit, offset)

  const stmt = db.prepare(sql)
  const rows = stmt.all(...(args as never[])) as unknown as SoundRowRaw[]
  return rows.map(parseRow)
}

export function countMatchingSounds(db: DatabaseSync, params: SearchParams): number {
  const { query, maxDuration, channels, category, subcategory, minConfidence, favoriteOnly } = params
  const clauses: string[] = []
  const args: unknown[] = []

  let sql: string
  if (query && query.trim().length > 0) {
    sql = `SELECT COUNT(*) as c
           FROM sounds_fts f
           JOIN sounds s ON s.id = f.rowid
           WHERE sounds_fts MATCH ?`
    args.push(ftsPrefixQuery(query))
  } else {
    sql = `SELECT COUNT(*) as c FROM sounds s`
    clauses.push('1=1')
  }

  if (maxDuration !== undefined) {
    clauses.push('s.duration IS NOT NULL AND s.duration < ?')
    args.push(maxDuration)
  }
  if (channels !== undefined) {
    clauses.push('s.channels = ?')
    args.push(channels)
  }
  if (category !== undefined) {
    clauses.push('s.category = ?')
    args.push(category)
  }
  if (subcategory !== undefined) {
    clauses.push('s.subcategory = ?')
    args.push(subcategory)
  }
  if (minConfidence !== undefined) {
    clauses.push('s.confidence >= ?')
    args.push(minConfidence)
  }
  if (favoriteOnly) {
    clauses.push('s.favorite = 1')
  }

  if (clauses.length > 0) {
    sql += (query && query.trim().length > 0 ? ' AND ' : ' WHERE ') + clauses.join(' AND ')
  }

  const stmt = db.prepare(sql)
  const row = stmt.get(...(args as never[])) as { c: number }
  return row?.c ?? 0
}

function ftsPrefixQuery(raw: string): string {
  const term = raw.trim().replace(/["]/g, '')
  return `"${term}"*`
}

export function countSounds(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) as c FROM sounds').get() as { c: number }
  return row.c
}

export interface CategoryFacet {
  category: string
  subcategory: string | null
  count: number
}

export function getCategoryFacets(db: DatabaseSync): CategoryFacet[] {
  const rows = db
    .prepare(
      `SELECT category, subcategory, COUNT(*) as count
       FROM sounds
       GROUP BY category, subcategory
       ORDER BY count DESC`
    )
    .all() as { category: string; subcategory: string | null; count: number }[]
  return rows
}
