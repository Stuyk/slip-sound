import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

export interface CategoryFacet {
  category: string
  subcategory: string | null
  count: number
}

export interface RecentEntry {
  folder: string
  openedAt: number
}

export type ExportFormat = 'wav' | 'ogg'
export type BitDepth = 16 | 24 | 32
export type NamingMode = 'original' | 'numeric' | 'alpha'

export interface ExportBatchFile {
  sourcePath: string
  start?: number
  end?: number
}

export interface ExportBatchParams {
  files: ExportBatchFile[]
  format: ExportFormat
  sampleRate: number
  bitDepth?: BitDepth
  oggQuality?: number
  naming: NamingMode
  baseName: string
}

export interface ExportBatchFileResult {
  sourcePath: string
  destPath?: string
  ok: boolean
  error?: string
}

export interface ExportBatchResult {
  canceled: boolean
  destFolder?: string
  results: ExportBatchFileResult[]
}

export interface McpStatus {
  enabled: boolean
  running: boolean
  port: number | null
  token: string | null
  url: string | null
}

const api = {
  pickAndOpenFolder: (): Promise<{ folder: string; count: number } | null> =>
    ipcRenderer.invoke('folder:pick-and-open'),
  openFolder: (folder: string): Promise<{ folder: string; count: number }> =>
    ipcRenderer.invoke('folder:open', folder),
  getRecentFolders: (): Promise<RecentEntry[]> => ipcRenderer.invoke('folder:recent'),
  removeRecentFolder: (folder: string): Promise<RecentEntry[]> =>
    ipcRenderer.invoke('folder:remove-recent', folder),
  getCurrentFolder: (): Promise<{ folder: string; count: number } | null> =>
    ipcRenderer.invoke('folder:current'),
  openLastFolder: (): Promise<{ folder: string; count: number } | null> =>
    ipcRenderer.invoke('folder:open-last'),
  reindex: (): Promise<{ fileCount: number; durationMs: number }> =>
    ipcRenderer.invoke('sounds:reindex'),
  onReindexProgress: (cb: (done: number, total: number) => void): (() => void) => {
    const handler = (_e: unknown, data: { done: number; total: number }): void => cb(data.done, data.total)
    ipcRenderer.on('sounds:reindex-progress', handler)
    return () => ipcRenderer.removeListener('sounds:reindex-progress', handler)
  },
  onReindexStart: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('sounds:reindex-start', handler)
    return () => ipcRenderer.removeListener('sounds:reindex-start', handler)
  },
  onReindexEnd: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('sounds:reindex-end', handler)
    return () => ipcRenderer.removeListener('sounds:reindex-end', handler)
  },
  search: (params: SearchParams): Promise<SoundRow[]> => ipcRenderer.invoke('sounds:search', params),
  count: (params: SearchParams): Promise<number> => ipcRenderer.invoke('sounds:count', params),
  getCategoryFacets: (): Promise<CategoryFacet[]> => ipcRenderer.invoke('sounds:category-facets'),
  toggleFavorite: (path: string): Promise<boolean> => ipcRenderer.invoke('sounds:toggle-favorite', path),
  setCategory: (path: string, category: string, subcategory: string | null): Promise<void> =>
    ipcRenderer.invoke('sounds:set-category', path, category, subcategory),
  setCategories: (paths: string[], category: string, subcategory: string | null): Promise<void> =>
    ipcRenderer.invoke('sounds:set-categories', paths, category, subcategory),
  clearCategory: (path: string): Promise<void> => ipcRenderer.invoke('sounds:clear-category', path),
  clearCategories: (paths: string[]): Promise<void> => ipcRenderer.invoke('sounds:clear-categories', paths),
  revealInFolder: (path: string): void => ipcRenderer.send('shell:reveal', path),
  audioUrl: (filePath: string): string => {
    // Normalize Windows backslashes to '/' before splitting into segments —
    // splitting a raw "C:\Users\bob\sounds\file.wav" on '/' found nothing to
    // split on, so the whole path (backslashes and all) got encoded as one
    // opaque blob glued directly onto "sound-file://local" with no path
    // separator at all. That produced an unparseable URL and broke audio
    // loading entirely on Windows. Always emit an explicit leading '/' too —
    // the main-process protocol handler already expects and strips a
    // leading slash before a Windows drive letter (e.g. "/C:/...").
    const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
    const encoded = normalized
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')
    return `sound-file://local/${encoded}`
  },
  exportBatch: (params: ExportBatchParams): Promise<ExportBatchResult> =>
    ipcRenderer.invoke('sounds:export-batch', params),
  onExportBatchProgress: (cb: (done: number, total: number) => void): (() => void) => {
    const handler = (_e: unknown, data: { done: number; total: number }): void => cb(data.done, data.total)
    ipcRenderer.on('sounds:export-batch-progress', handler)
    return () => ipcRenderer.removeListener('sounds:export-batch-progress', handler)
  },
  exportRegionToTemp: (params: {
    sourcePath: string
    sampleRate: number
    start: number
    end: number
  }): Promise<string> => ipcRenderer.invoke('sounds:export-temp', params),
  startDrag: (filePaths: string[]): void => ipcRenderer.send('drag:start', filePaths),
  getMcpStatus: (): Promise<McpStatus> => ipcRenderer.invoke('mcp:get-status'),
  setMcpEnabled: (enabled: boolean): Promise<McpStatus> => ipcRenderer.invoke('mcp:set-enabled', enabled),
  getAutoCategorizationEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:get-auto-categorization'),
  setAutoCategorizationEnabled: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('settings:set-auto-categorization', enabled)
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
