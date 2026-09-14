import { app, shell, BrowserWindow, ipcMain, dialog, protocol, WebContents, nativeImage, net } from 'electron'
import { join, basename, extname } from 'path'
import { pathToFileURL } from 'url'
import { mkdtemp } from 'fs/promises'
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
import { getLastExportFolder, setLastExportFolder, getMcpEnabled, setMcpEnabled } from './prefs'
import { exportRegion, generateExportFilename, ExportFormat, BitDepth, NamingMode } from './export'
import { existsSync } from 'fs'
import { startMcpServer, McpServerHandle, McpDeps } from './mcp/server'
import { writeMcpConnectionInfo, clearMcpConnectionInfo } from './mcp/connectionInfo'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sound-file',
    privileges: { standard: true, stream: true, bypassCSP: true, supportFetchAPI: true, corsEnabled: true }
  }
])



let currentDb: DatabaseSync | null = null
let currentFolder: string | null = null
let mainWindow: BrowserWindow | null = null
let mcpHandle: McpServerHandle | null = null

function runReindex(sender: WebContents): { fileCount: number; durationMs: number } {
  if (!currentDb || !currentFolder) throw new Error('No folder open')
  sender.send('sounds:reindex-start')
  try {
    return reindexFolder(currentDb, currentFolder, (done, total) => {
      sender.send('sounds:reindex-progress', { done, total })
    })
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
    return reindexFolder(currentDb, currentFolder)
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
    return net.fetch(pathToFileURL(filePath).toString())
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
  }
  interface ExportBatchParams {
    files: ExportBatchFile[]
    format: ExportFormat
    sampleRate: number
    bitDepth?: BitDepth
    oggQuality?: number
    naming: NamingMode
    baseName: string
  }
  interface ExportBatchFileResult {
    sourcePath: string
    destPath?: string
    ok: boolean
    error?: string
  }

  ipcMain.handle('sounds:export-batch', async (event, params: ExportBatchParams) => {
    if (!mainWindow) return { canceled: true, results: [] }
    const { files, format, sampleRate, bitDepth, oggQuality, naming, baseName } = params

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
      const originalStem = basename(file.sourcePath, extname(file.sourcePath))
      let stem = generateExportFilename(originalStem, i, files.length, naming, baseName)

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
          end: file.end
        })
        results.push({ sourcePath: file.sourcePath, destPath, ok: true })
      } catch (err) {
        results.push({ sourcePath: file.sourcePath, ok: false, error: err instanceof Error ? err.message : String(err) })
      }

      event.sender.send('sounds:export-batch-progress', { done: i + 1, total: files.length })
    }

    return { canceled: false, destFolder, results }
  })

  ipcMain.handle(
    'sounds:export-temp',
    async (_e, params: { sourcePath: string; sampleRate: number; start: number; end: number }) => {
      const dir = await mkdtemp(join(tmpdir(), 'slip-sound-'))
      const base = basename(params.sourcePath, extname(params.sourcePath))
      const destPath = join(dir, `${base}_region.wav`)
      await exportRegion({
        sourcePath: params.sourcePath,
        destPath,
        format: 'wav',
        sampleRate: params.sampleRate,
        start: params.start,
        end: params.end
      })
      return destPath
    }
  )

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
