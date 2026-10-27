import { app, shell, BrowserWindow, ipcMain, dialog, protocol, WebContents, nativeImage } from 'electron'
import { join, basename, extname } from 'path'
import { mkdtemp, stat, writeFile } from 'fs/promises'
import { createReadStream, existsSync } from 'fs'
import { Readable } from 'stream'
import { tmpdir } from 'os'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { DatabaseSync } from 'node:sqlite'
import icon from '../../resources/icon.png?asset'
import {
  openDatabase,
  searchSounds,
  countSounds,
  countMatchingSounds,
  getCategoryFacets,
  toggleFavorite,
  setCategory,
  setCategories,
  clearCategory,
  clearCategories,
  getSoundByPath,
  SearchParams
} from './db'
import { reindexFolder } from './indexer'
import { getRecentFolders, addRecentFolder, removeRecentFolder } from './recent'
import {
  getLastExportFolder,
  setLastExportFolder,
  getMcpEnabled,
  setMcpEnabled,
  getAutoCategorizationEnabled,
  setAutoCategorizationEnabled
} from './prefs'
import {
  exportRegion,
  generateExportFilename,
  getCapabilities,
  measureLoudness,
  sanitizeStem,
  ExportFormat,
  BitDepth,
  NamingMode
} from './export'
import {
  type RenderRequest,
  clearDragFolder,
  dragFolder,
  dragFolderInfo,
  renderProcessed,
  stageForDrag,
  trimRenderCache
} from './renders'
import { deletePreset, exportPresets, importPresets, listPresets, savePreset } from './presets'
import { setDragBitDepth, setDragExportFolderPref } from './prefs'
import {
  type ProcessingEffects,
  type ProcessingSettings,
  decideGain,
  isIdentity,
  suffixFor,
  withoutFades
} from '../shared/processing'
import { startMcpServer, McpServerHandle, McpDeps } from './mcp/server'
import { writeMcpConnectionInfo, clearMcpConnectionInfo } from './mcp/connectionInfo'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sound-file',
    privileges: { standard: true, stream: true, bypassCSP: true, supportFetchAPI: true, corsEnabled: true }
  }
])



const AUDIO_MIME: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
  '.m4a': 'audio/mp4'
}

// Serves a local audio file with proper HTTP Range support. The <audio>
// element issues `Range: bytes=N-` requests whenever it seeks (click-to-seek,
// region looping). Proxying to net.fetch(file://) ignores the Range header and
// returns the whole file from byte 0, so the media pipeline decodes header /
// misaligned PCM bytes as if they started at offset N — heard as a burst of
// extremely loud static.
async function serveAudioFile(filePath: string, rangeHeader: string | null): Promise<Response> {
  let size: number
  try {
    const st = await stat(filePath)
    if (!st.isFile()) return new Response(null, { status: 404 })
    size = st.size
  } catch {
    return new Response(null, { status: 404 })
  }

  const headers: Record<string, string> = {
    'Content-Type': AUDIO_MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes'
  }

  const toBody = (start: number, end: number): ReadableStream =>
    Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream

  const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null
  if (!match || (match[1] === '' && match[2] === '')) {
    headers['Content-Length'] = String(size)
    return new Response(size > 0 ? toBody(0, size - 1) : null, { status: 200, headers })
  }

  let start: number
  let end: number
  if (match[1] === '') {
    // Suffix range: last N bytes
    start = Math.max(0, size - parseInt(match[2], 10))
    end = size - 1
  } else {
    start = parseInt(match[1], 10)
    end = match[2] === '' ? size - 1 : Math.min(parseInt(match[2], 10), size - 1)
  }

  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }

  headers['Content-Range'] = `bytes ${start}-${end}/${size}`
  headers['Content-Length'] = String(end - start + 1)
  return new Response(toBody(start, end), { status: 206, headers })
}

let currentDb: DatabaseSync | null = null
let currentFolder: string | null = null
let mainWindow: BrowserWindow | null = null
let mcpHandle: McpServerHandle | null = null

function runReindex(sender: WebContents): { fileCount: number; durationMs: number } {
  if (!currentDb || !currentFolder) throw new Error('No folder open')
  sender.send('sounds:reindex-start')
  try {
    return reindexFolder(
      currentDb,
      currentFolder,
      (done, total) => sender.send('sounds:reindex-progress', { done, total }),
      getAutoCategorizationEnabled()
    )
  } finally {
    sender.send('sounds:reindex-end')
  }
}

function openFolder(folder: string, sender: WebContents): { folder: string; count: number } {
  currentDb?.close()
  const db = openDatabase(folder)
  currentDb = db
  currentFolder = folder
  addRecentFolder(folder)
  const count = countSounds(db)
  if (count === 0) {
    runReindex(sender)
    return { folder, count: countSounds(db) }
  }
  return { folder, count }
}

const mcpDeps: McpDeps = {
  getLibrary: () => (currentFolder ? { folder: currentFolder, count: currentDb ? countSounds(currentDb) : 0 } : null),
  openLibrary: (folderPath) => {
    if (!mainWindow) throw new Error('No window available')
    return openFolder(folderPath, mainWindow.webContents)
  },
  getRecentLibraries: () => getRecentFolders(),
  search: (params) => (currentDb ? searchSounds(currentDb, params) : []),
  countMatching: (params) => (currentDb ? countMatchingSounds(currentDb, params) : 0),
  getSound: (path) => (currentDb ? getSoundByPath(currentDb, path) : null),
  getCategoryFacets: () => (currentDb ? getCategoryFacets(currentDb) : []),
  toggleFavorite: (path) => (currentDb ? toggleFavorite(currentDb, path) : false),
  setCategory: (path, category, subcategory) => {
    if (!currentDb) throw new Error('No library open')
    setCategory(currentDb, path, category, subcategory)
  },
  clearCategory: (path) => {
    if (!currentDb) throw new Error('No library open')
    clearCategory(currentDb, path)
  },
  revealInFolder: (path) => shell.showItemInFolder(path),
  exportSound: async (params) => {
    await exportRegion(params)
    return params.destPath
  },
  reindex: async () => {
    if (!currentDb || !currentFolder) throw new Error('No folder open')
    return reindexFolder(currentDb, currentFolder, undefined, getAutoCategorizationEnabled())
  }
}

async function enableMcp(): Promise<void> {
  if (mcpHandle) return // already running
  try {
    const handle = await startMcpServer(mcpDeps)
    mcpHandle = handle
    writeMcpConnectionInfo(handle.port, handle.token)
    console.log(`[mcp] listening on http://127.0.0.1:${handle.port}/mcp`)
  } catch (err) {
    console.error('[mcp] failed to start:', err instanceof Error ? err.message : err)
  }
}

async function disableMcp(): Promise<void> {
  if (!mcpHandle) return
  const handle = mcpHandle
  mcpHandle = null
  clearMcpConnectionInfo()
  await handle.stop()
}

function getMcpStatus(): { enabled: boolean; running: boolean; port: number | null; token: string | null; url: string | null } {
  const enabled = getMcpEnabled()
  return {
    enabled,
    running: !!mcpHandle,
    port: mcpHandle?.port ?? null,
    token: mcpHandle?.token ?? null,
    url: mcpHandle ? `http://127.0.0.1:${mcpHandle.port}/mcp` : null
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'Slip Sound',
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.slipsound.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  protocol.handle('sound-file', (request) => {
    let filePath = decodeURIComponent(new URL(request.url).pathname)
    if (process.platform === 'win32' && filePath.startsWith('/') && filePath[2] === ':') {
      filePath = filePath.slice(1)
    }
    return serveAudioFile(filePath, request.headers.get('range'))
  })

  ipcMain.handle('folder:pick-and-open', async (event) => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return openFolder(result.filePaths[0], event.sender)
  })

  ipcMain.handle('folder:open', async (event, folder: string) => {
    return openFolder(folder, event.sender)
  })

  ipcMain.handle('folder:open-last', async (event) => {
    const [mostRecent] = getRecentFolders()
    if (!mostRecent) return null
    try {
      return openFolder(mostRecent.folder, event.sender)
    } catch {
      // Folder was moved/deleted/unmounted since last time — don't error the
      // whole launch over it, just fall back to the normal welcome screen.
      removeRecentFolder(mostRecent.folder)
      return null
    }
  })

  ipcMain.handle('folder:recent', () => {
    return getRecentFolders()
  })

  ipcMain.handle('folder:remove-recent', (_e, folder: string) => {
    removeRecentFolder(folder)
    return getRecentFolders()
  })

  ipcMain.handle('folder:current', () => {
    return currentFolder ? { folder: currentFolder, count: currentDb ? countSounds(currentDb) : 0 } : null
  })

  ipcMain.handle('sounds:reindex', async (event) => {
    return runReindex(event.sender)
  })

  ipcMain.handle('sounds:search', (_e, params: SearchParams) => {
    if (!currentDb) return []
    return searchSounds(currentDb, params)
  })

  ipcMain.handle('sounds:count', (_e, params: SearchParams) => {
    if (!currentDb) return 0
    return countMatchingSounds(currentDb, params)
  })

  ipcMain.handle('sounds:category-facets', () => {
    if (!currentDb) return []
    return getCategoryFacets(currentDb)
  })

  ipcMain.handle('sounds:toggle-favorite', (_e, path: string) => {
    if (!currentDb) return false
    return toggleFavorite(currentDb, path)
  })

  ipcMain.handle('sounds:set-category', (_e, path: string, category: string, subcategory: string | null) => {
    if (!currentDb) return
    setCategory(currentDb, path, category, subcategory)
  })

  ipcMain.handle('sounds:set-categories', (_e, paths: string[], category: string, subcategory: string | null) => {
    if (!currentDb) return
    setCategories(currentDb, paths, category, subcategory)
  })

  ipcMain.handle('sounds:clear-category', (_e, path: string) => {
    if (!currentDb) return
    clearCategory(currentDb, path)
  })

  ipcMain.handle('sounds:clear-categories', (_e, paths: string[]) => {
    if (!currentDb) return
    clearCategories(currentDb, paths)
  })

  ipcMain.on('shell:reveal', (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  interface ExportBatchFile {
    sourcePath: string
    start?: number
    end?: number
    // Output stem override (e.g. a named slice); used by "keep original" naming.
    name?: string
    // Seamless loop output: skip fades, they would break the loop join.
    excludeFades?: boolean
  }
  interface ExportBatchParams {
    files: ExportBatchFile[]
    format: ExportFormat
    sampleRate: number
    bitDepth?: BitDepth
    oggQuality?: number
    naming: NamingMode
    baseName: string
    processing?: ProcessingSettings
  }
  interface ExportBatchFileResult {
    sourcePath: string
    destPath?: string
    ok: boolean
    error?: string
  }

  ipcMain.handle('sounds:export-batch', async (event, params: ExportBatchParams) => {
    if (!mainWindow) return { canceled: true, results: [] }
    const { files, format, sampleRate, bitDepth, oggQuality, naming, baseName, processing } = params

    const lastFolder = getLastExportFolder()
    const dirResult = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose export destination folder',
      ...(lastFolder && existsSync(lastFolder) ? { defaultPath: lastFolder } : {})
    })
    if (dirResult.canceled || dirResult.filePaths.length === 0) return { canceled: true, results: [] }
    const destFolder = dirResult.filePaths[0]
    setLastExportFolder(destFolder)

    const results: ExportBatchFileResult[] = []
    const usedNames = new Set<string>()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const originalStem = sanitizeStem(file.name) ?? basename(file.sourcePath, extname(file.sourcePath))
      const settings =
        processing && !isIdentity(processing) ? (file.excludeFades ? withoutFades(processing) : processing) : undefined
      const tag = settings ? suffixFor(settings) : ''
      let stem = generateExportFilename(originalStem, i, files.length, naming, baseName)
      if (tag) stem = `${stem}__${tag}`

      // Guard against filename collisions (e.g. two source files that share
      // a stem under "keep original", or a re-run into the same folder).
      let candidate = stem
      let suffix = 2
      while (usedNames.has(candidate) || existsSync(join(destFolder, `${candidate}.${format}`))) {
        candidate = `${stem}_${suffix}`
        suffix++
      }
      stem = candidate
      usedNames.add(stem)

      const destPath = join(destFolder, `${stem}.${format}`)
      try {
        await exportRegion({
          sourcePath: file.sourcePath,
          destPath,
          format,
          sampleRate,
          bitDepth,
          oggQuality,
          start: file.start,
          end: file.end,
          processing: settings
        })
        results.push({ sourcePath: file.sourcePath, destPath, ok: true })
      } catch (err) {
        results.push({ sourcePath: file.sourcePath, ok: false, error: err instanceof Error ? err.message : String(err) })
      }

      event.sender.send('sounds:export-batch-progress', { done: i + 1, total: files.length })
    }

    return { canceled: false, destFolder, results }
  })

  // ---- Processing / drag-out renders (specs/processing.md) ----
  ipcMain.handle('process:capabilities', () => getCapabilities())

  ipcMain.handle('process:render', (_e, req: RenderRequest) => renderProcessed(req))

  // Loudness readout for the Process panel: measured after the pre-gain chain.
  ipcMain.handle('process:measure', async (_e, req: RenderRequest) => {
    const measurement = await measureLoudness({
      sourcePath: req.sourcePath,
      start: req.start,
      end: req.end,
      processing: req.processing
    })
    return { measurement, gain: req.processing ? decideGain(req.processing, measurement) : null }
  })

  // Copies cached renders into the persistent drag folder, then starts the OS drag.
  ipcMain.on('drag:start-rendered', (event, items: Array<{ path: string; name: string }>) => {
    if (!Array.isArray(items) || items.length === 0) return
    const files = stageForDrag(items)
    event.sender.startDrag({
      file: files[0],
      files,
      icon: nativeImage.createFromPath(icon).resize({ width: 32, height: 32 })
    })
  })

  ipcMain.handle('drag:info', () => dragFolderInfo())
  ipcMain.handle('drag:open-folder', () => shell.openPath(dragFolder().folder))
  ipcMain.handle('drag:choose-folder', async () => {
    if (!mainWindow) return dragFolderInfo()
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose drag export folder',
      defaultPath: dragFolder().folder
    })
    if (!res.canceled && res.filePaths[0]) setDragExportFolderPref(res.filePaths[0])
    return dragFolderInfo()
  })
  ipcMain.handle('drag:reset-folder', () => {
    setDragExportFolderPref(undefined)
    return dragFolderInfo()
  })
  ipcMain.handle('drag:set-bit-depth', (_e, bits: number) => {
    if (bits === 16 || bits === 24 || bits === 32) setDragBitDepth(bits)
    return dragFolderInfo()
  })
  ipcMain.handle('drag:clear', async () => {
    const removed = await clearDragFolder()
    return { removed, info: dragFolderInfo() }
  })

  ipcMain.handle('presets:list', () => listPresets())
  ipcMain.handle('presets:save', (_e, input: { id?: string; name: string; settings: ProcessingEffects }) => {
    savePreset(input)
    return listPresets()
  })
  ipcMain.handle('presets:delete', (_e, id: string) => {
    deletePreset(id)
    return listPresets()
  })
  ipcMain.handle('presets:export', async () => {
    if (!mainWindow) return null
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Export processing presets',
      defaultPath: 'slip-sound-presets.json',
      filters: [{ name: 'Presets', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return null
    return exportPresets(res.filePath)
  })
  ipcMain.handle('presets:import', async () => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Import processing presets',
      properties: ['openFile'],
      filters: [{ name: 'Presets', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    const added = importPresets(res.filePaths[0])
    return { added, presets: listPresets() }
  })

  // Audio rendered in the renderer (e.g. a seamless loop) lands in a fresh temp
  // dir so it can go through the normal export pipeline like any source file.
  const MAX_TEMP_WAV_BYTES = 2 * 1024 * 1024 * 1024
  ipcMain.handle('sounds:write-temp-wav', async (_e, data: unknown, stem: unknown) => {
    if (!(data instanceof Uint8Array) || data.byteLength > MAX_TEMP_WAV_BYTES) {
      throw new Error('Invalid audio data')
    }
    const dir = await mkdtemp(join(tmpdir(), 'slip-sound-'))
    const name = sanitizeStem(typeof stem === 'string' ? stem : undefined) ?? 'audio'
    const destPath = join(dir, `${name}.wav`)
    await writeFile(destPath, data)
    return destPath
  })

  ipcMain.on('drag:start', (event, filePaths: string[]) => {
    if (filePaths.length === 0) return
    event.sender.startDrag({
      file: filePaths[0],
      files: filePaths,
      icon: nativeImage.createFromPath(icon).resize({ width: 32, height: 32 })
    })
  })

  ipcMain.handle('mcp:get-status', () => getMcpStatus())

  ipcMain.handle('mcp:set-enabled', async (_e, enabled: boolean) => {
    setMcpEnabled(enabled)
    if (enabled) {
      await enableMcp()
    } else {
      await disableMcp()
    }
    return getMcpStatus()
  })

  ipcMain.handle('settings:get-auto-categorization', () => getAutoCategorizationEnabled())

  ipcMain.handle('settings:set-auto-categorization', (_e, enabled: boolean) => {
    setAutoCategorizationEnabled(enabled)
    return getAutoCategorizationEnabled()
  })

  try {
    trimRenderCache()
  } catch {
    // cache trimming is best-effort
  }
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // MCP server: exposes the library to external AI hosts (Claude Desktop,
  // Cursor, VS Code, ...) over local Streamable HTTP. Entirely optional to
  // the rest of the app — if it fails to bind (port taken, etc.) we just log
  // and move on, the desktop app itself works the same either way. Only
  // auto-starts if the user hasn't turned it off from Settings.
  if (getMcpEnabled()) {
    void enableMcp()
  }
})

app.on('window-all-closed', () => {
  currentDb?.close()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  clearMcpConnectionInfo()
  void mcpHandle?.stop()
})
