// Persists the running MCP server's connection details so external tools
// (or the user, configuring Claude Desktop / Cursor / VS Code) can find the
// port and bearer token without digging through logs. Isolated on purpose —
// nothing outside src/main/mcp/ reads or writes this file.

import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync, existsSync } from 'fs'

function filePath(): string {
  return join(app.getPath('userData'), 'mcp-connection.json')
}

export function writeMcpConnectionInfo(port: number, token: string): void {
  const info = {
    url: `http://127.0.0.1:${port}/mcp`,
    token,
    // Ready to paste into an MCP host's config (e.g. mcp.json), under
    // whatever key that host expects inside "mcpServers".
    mcpServersEntry: {
      'slip-sound': {
        type: 'http',
        url: `http://127.0.0.1:${port}/mcp`,
        headers: { Authorization: `Bearer ${token}` }
      }
    }
  }
  writeFileSync(filePath(), JSON.stringify(info, null, 2))
}

export function clearMcpConnectionInfo(): void {
  const p = filePath()
  if (existsSync(p)) unlinkSync(p)
}
