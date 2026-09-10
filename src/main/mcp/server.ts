// MCP (Model Context Protocol) server for SlipSound.
//
// Exposes the sound library to external AI hosts (Claude Desktop, Cursor,
// VS Code, etc.) as an MCP Server over local Streamable HTTP, per Pattern 1
// ("Desktop App as an MCP Server"). Deliberately self-contained: this module
// knows nothing about Electron, the renderer, or the rest of main/ beyond
// the plain-function dependencies handed to it in `startMcpServer(deps)`.
// The rest of the app doesn't import anything from here except that one
// start/stop pair, so it can be deleted or disabled without touching
// anything else.

import { createServer, IncomingMessage, ServerResponse, Server as HttpServer } from 'http'
import { randomBytes, randomUUID } from 'crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

export interface McpSoundRow {
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
}

export interface McpSearchParams {
  query: string
  maxDuration?: number
  channels?: number
  category?: string
  subcategory?: string
  favoriteOnly?: boolean
  sortBy?: 'favorite' | 'filename' | 'category' | 'duration' | 'channels' | 'sample_rate' | 'filesize'
  sortDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface McpRecentLibrary {
  folder: string
  openedAt: number
}

export interface McpExportParams {
  sourcePath: string
  destPath: string
  format: 'wav' | 'ogg'
  sampleRate: number
  bitDepth?: 16 | 24 | 32
  oggQuality?: number
  start?: number
  end?: number
}

export interface McpDeps {
  getLibrary: () => { folder: string; count: number } | null
  openLibrary: (folderPath: string) => { folder: string; count: number }
  getRecentLibraries: () => McpRecentLibrary[]
  search: (params: McpSearchParams) => McpSoundRow[]
  countMatching: (params: McpSearchParams) => number
  getSound: (path: string) => McpSoundRow | null
  getCategoryFacets: () => { category: string; subcategory: string | null; count: number }[]
  toggleFavorite: (path: string) => boolean
  setCategory: (path: string, category: string, subcategory: string | null) => void
  clearCategory: (path: string) => void
  revealInFolder: (path: string) => void
  exportSound: (params: McpExportParams) => Promise<string>
  reindex: () => Promise<{ fileCount: number; durationMs: number }>
}

export interface McpServerHandle {
  port: number
  token: string
  stop: () => Promise<void>
}

const HOST = '127.0.0.1'

function buildMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: 'slip-sound', version: '1.0.0' })

  server.registerTool(
    'search_sounds',
    {
      title: 'Search for sound files',
      description:
        'Searches the currently open SlipSound library for audio files. This is the primary way to find ' +
        'sound files — pass `query` to match against filenames (prefix match per word, e.g. "expl" ' +
        'matches "explosion_01.wav"), and/or narrow by category, subcategory, channel count, max ' +
        'duration, or favorite status. Leave `query` empty to just filter/browse. Returns each match\'s ' +
        'absolute path, filename, duration, channels, sample rate, filesize, category, confidence, and ' +
        'favorite flag — use the path with get_sound, export_sound, toggle_favorite, set_category, etc.',
      inputSchema: {
        query: z.string().default('').describe('Filename search text (per-word prefix match), empty for no filter'),
        category: z.string().optional().describe('Exact category name, e.g. "Weapons"'),
        subcategory: z.string().optional().describe('Exact subcategory name, e.g. "Firearms"'),
        channels: z.number().int().optional().describe('1 for mono, 2 for stereo'),
        maxDuration: z.number().optional().describe('Only sounds shorter than this many seconds'),
        favoriteOnly: z.boolean().optional(),
        sortBy: z
          .enum(['favorite', 'filename', 'category', 'duration', 'channels', 'sample_rate', 'filesize'])
          .optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0)
      }
    },
    async (params) => {
      if (!deps.getLibrary()) {
        return {
          content: [{ type: 'text', text: 'No library is currently open in SlipSound.' }],
          isError: true
        }
      }
      const rows = deps.search(params)
      const total = deps.countMatching(params)
      return {
        content: [{ type: 'text', text: JSON.stringify({ total, results: rows }, null, 2) }]
      }
    }
  )

  server.registerTool(
    'list_uncategorized_sounds',
    {
      title: 'Page through uncategorized sounds',
      description:
        'Returns sounds still stuck at "Uncategorized" (the auto-classifier found no matching keyword ' +
        'in their filename), one page at a time — built for an agent to work through a library and tag ' +
        'the leftovers with set_category. Stable pagination: sorted by filename, so the same page number ' +
        'returns the same slice across calls even as you categorize earlier ones. Use `totalPages` in the ' +
        'response to know when to stop.',
      inputSchema: {
        page: z.number().int().min(1).default(1).describe('1-based page number'),
        pageSize: z.number().int().min(1).max(200).default(25)
      }
    },
    async ({ page, pageSize }) => {
      if (!deps.getLibrary()) {
        return {
          content: [{ type: 'text', text: 'No library is currently open in SlipSound.' }],
          isError: true
        }
      }
      const searchParams: McpSearchParams = {
        query: '',
        category: 'Uncategorized',
        sortBy: 'filename',
        sortDir: 'asc',
        limit: pageSize,
        offset: (page - 1) * pageSize
      }
      const results = deps.search(searchParams)
      const total = deps.countMatching(searchParams)
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      return {
        content: [
          { type: 'text', text: JSON.stringify({ page, pageSize, total, totalPages, results }, null, 2) }
        ]
      }
    }
  )

  server.registerTool(
    'open_library',
    {
      title: 'Open a sound library folder',
      description:
        'Opens (or switches to) a SlipSound library at the given absolute folder path. Creates a new ' +
        'index and auto-classifies every audio file if this folder has never been opened before ' +
        '(can take a while on large folders). Also updates the desktop app\'s UI if it is open.',
      inputSchema: {
        folderPath: z.string().describe('Absolute path to the folder containing audio files')
      }
    },
    async ({ folderPath }) => {
      try {
        const result = deps.openLibrary(folderPath)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
          isError: true
        }
      }
    }
  )

  server.registerTool(
    'get_recent_libraries',
    {
      title: 'Get recently opened libraries',
      description: 'Returns SlipSound folders opened previously, most recent first — useful for picking one to open_library.'
    },
    async () => {
      return { content: [{ type: 'text', text: JSON.stringify(deps.getRecentLibraries(), null, 2) }] }
    }
  )

  server.registerTool(
    'get_sound',
    {
      title: 'Get one sound by path',
      description: 'Looks up a single sound\'s full metadata by its exact absolute path, as returned by search_sounds.',
      inputSchema: {
        path: z.string().describe('Absolute file path of the sound')
      }
    },
    async ({ path }) => {
      const sound = deps.getSound(path)
      if (!sound) {
        return { content: [{ type: 'text', text: `No sound found at ${path}` }], isError: true }
      }
      return { content: [{ type: 'text', text: JSON.stringify(sound, null, 2) }] }
    }
  )

  server.registerTool(
    'get_library_status',
    {
      title: 'Get current library status',
      description: 'Returns the folder path and total sound count of the currently open SlipSound library, or null if none is open.'
    },
    async () => {
      const lib = deps.getLibrary()
      return { content: [{ type: 'text', text: JSON.stringify(lib) }] }
    }
  )

  server.registerTool(
    'get_categories',
    {
      title: 'Get category facets',
      description: 'Returns category/subcategory names with sound counts for the currently open library, for browsing/drill-down.'
    },
    async () => {
      const facets = deps.getCategoryFacets()
      return { content: [{ type: 'text', text: JSON.stringify(facets, null, 2) }] }
    }
  )

  server.registerTool(
    'toggle_favorite',
    {
      title: 'Toggle favorite on a sound',
      description: 'Flips the favorite flag on the sound at the given absolute path. Returns the new favorite state.',
      inputSchema: {
        path: z.string().describe('Absolute file path of the sound, as returned by search_sounds')
      }
    },
    async ({ path }) => {
      const next = deps.toggleFavorite(path)
      return { content: [{ type: 'text', text: JSON.stringify({ path, favorite: next }) }] }
    }
  )

  server.registerTool(
    'set_category',
    {
      title: 'Set a sound\'s category',
      description:
        'Manually assigns a category (and optional subcategory) to a sound. This marks it so a future ' +
        'reindex will not overwrite the choice with the auto-classifier\'s guess.',
      inputSchema: {
        path: z.string().describe('Absolute file path of the sound'),
        category: z.string().min(1).describe('Category name, e.g. "Weapons"'),
        subcategory: z.string().optional().describe('Optional subcategory, e.g. "Firearms"')
      }
    },
    async ({ path, category, subcategory }) => {
      deps.setCategory(path, category, subcategory ?? null)
      return { content: [{ type: 'text', text: JSON.stringify({ path, category, subcategory: subcategory ?? null }) }] }
    }
  )

  server.registerTool(
    'clear_category',
    {
      title: 'Clear a sound\'s category',
      description:
        'Reverts a sound to "Uncategorized" and clears its manual-category flag, so the next reindex is ' +
        'free to auto-classify it again from its filename.',
      inputSchema: {
        path: z.string().describe('Absolute file path of the sound')
      }
    },
    async ({ path }) => {
      deps.clearCategory(path)
      return { content: [{ type: 'text', text: JSON.stringify({ path, category: 'Uncategorized' }) }] }
    }
  )

  server.registerTool(
    'reveal_in_folder',
    {
      title: 'Reveal a sound in the OS file manager',
      description: 'Opens the system file manager (Finder/Explorer/etc.) and highlights the given sound file.',
      inputSchema: {
        path: z.string().describe('Absolute file path of the sound')
      }
    },
    async ({ path }) => {
      deps.revealInFolder(path)
      return { content: [{ type: 'text', text: `Revealed ${path}` }] }
    }
  )

  server.registerTool(
    'export_sound',
    {
      title: 'Export a sound (optionally trimmed) to a new file',
      description:
        'Renders a sound — or a start/end trimmed region of it — to a new WAV or OGG file at the given ' +
        'destination path, resampled to the given sample rate. Overwrites destPath if it already exists.',
      inputSchema: {
        sourcePath: z.string().describe('Absolute path of the sound to export'),
        destPath: z.string().describe('Absolute destination file path, including extension'),
        format: z.enum(['wav', 'ogg']).describe('Output container/codec'),
        sampleRate: z.number().int().min(1000).max(192000).default(44100),
        bitDepth: z.enum(['16', '24', '32']).optional().describe('WAV only: PCM bit depth'),
        oggQuality: z.number().min(0).max(10).optional().describe('OGG only: VBR quality, 0-10'),
        start: z.number().optional().describe('Trim start in seconds, omit for start of file'),
        end: z.number().optional().describe('Trim end in seconds, omit for end of file')
      }
    },
    async ({ sourcePath, destPath, format, sampleRate, bitDepth, oggQuality, start, end }) => {
      try {
        const result = await deps.exportSound({
          sourcePath,
          destPath,
          format,
          sampleRate,
          bitDepth: bitDepth ? ((parseInt(bitDepth, 10)) as 16 | 24 | 32) : undefined,
          oggQuality,
          start,
          end
        })
        return { content: [{ type: 'text', text: JSON.stringify({ destPath: result }) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
          isError: true
        }
      }
    }
  )

  server.registerTool(
    'reindex_library',
    {
      title: 'Reindex the current library',
      description:
        'Re-scans the open library folder for new/changed/removed audio files and reclassifies them. ' +
        'Can take a while on large libraries (tens of thousands of files).'
    },
    async () => {
      if (!deps.getLibrary()) {
        return { content: [{ type: 'text', text: 'No library is currently open.' }], isError: true }
      }
      const result = await deps.reindex()
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    }
  )

  return server
}

function isAllowedOrigin(origin: string | undefined, port: number): boolean {
  if (!origin) return true // non-browser clients (CLI, MCP hosts) send no Origin
  return origin === `http://${HOST}:${port}` || origin === `http://localhost:${port}`
}

function isAllowedHost(host: string | undefined, port: number): boolean {
  if (!host) return false
  return host === `${HOST}:${port}` || host === `localhost:${port}`
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return undefined
  const raw = Buffer.concat(chunks).toString('utf-8')
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function sendJsonRpcError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(
    JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null })
  )
}

export function startMcpServer(deps: McpDeps, preferredPort = 39457): Promise<McpServerHandle> {
  const token = randomBytes(24).toString('hex')
  const mcpServer = buildMcpServer(deps)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID })

  let connected = false
  let actualPort = preferredPort

  const httpServer: HttpServer = createServer((req, res) => {
    void (async () => {
      const host = req.headers.host
      const origin = req.headers.origin
      const auth = req.headers.authorization

      // Localhost-only enforcement: reject anything that doesn't present the
      // exact host we bound to (blocks DNS-rebinding attempts from a page
      // the user has open in a browser) and require the bearer token minted
      // at startup (blocks any other localhost process/user from just
      // guessing the port).
      if (!isAllowedHost(host, actualPort) || !isAllowedOrigin(origin, actualPort)) {
        sendJsonRpcError(res, 403, 'Forbidden: invalid Host/Origin')
        return
      }
      if (auth !== `Bearer ${token}`) {
        sendJsonRpcError(res, 401, 'Unauthorized: missing or invalid bearer token')
        return
      }
      if (req.url !== '/mcp') {
        sendJsonRpcError(res, 404, 'Not found')
        return
      }

      try {
        const body = req.method === 'POST' ? await readBody(req) : undefined
        await transport.handleRequest(req, res, body)
      } catch (err) {
        console.error('[mcp] request failed:', err)
        if (!res.headersSent) {
          sendJsonRpcError(res, 500, err instanceof Error ? err.message : 'Internal server error')
        }
      }
    })()
  })

  return new Promise((resolve, reject) => {
    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (!connected) reject(err)
    })

    httpServer.listen(preferredPort, HOST, async () => {
      const addr = httpServer.address()
      if (addr && typeof addr === 'object') actualPort = addr.port

      try {
        await mcpServer.connect(transport)
        connected = true
        resolve({
          port: actualPort,
          token,
          stop: async () => {
            await transport.close()
            await mcpServer.close()
            await new Promise<void>((res) => httpServer.close(() => res()))
          }
        })
      } catch (err) {
        reject(err)
      }
    })
  })
}
