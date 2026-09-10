import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js'
import type { McpStatus } from '../../../preload/index'
import { XIcon, SettingsIcon, CopyIcon, CheckCircleIcon, EyeIcon, EyeOffIcon, RefreshCwIcon } from './icons'

export default function SettingsModal(props: { isOpen: boolean; onClose: () => void }) {
  const [status, setStatus] = createSignal<McpStatus | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [showToken, setShowToken] = createSignal(false)
  const [copiedField, setCopiedField] = createSignal<'url' | 'token' | null>(null)

  async function refresh(): Promise<void> {
    setStatus(await window.api.getMcpStatus())
  }

  createEffect(() => {
    if (props.isOpen) {
      setShowToken(false)
      refresh()
    }
  })

  async function toggleMcp(): Promise<void> {
    const current = status()
    if (!current || busy()) return
    setBusy(true)
    try {
      setStatus(await window.api.setMcpEnabled(!current.enabled))
    } finally {
      setBusy(false)
    }
  }

  async function copy(field: 'url' | 'token', value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500)
    } catch {
      // clipboard permissions denied — nothing sensible to do, just skip the feedback
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && props.isOpen) {
      e.preventDefault()
      props.onClose()
    }
  }

  onMount(() => window.addEventListener('keydown', onKeyDown))
  onCleanup(() => window.removeEventListener('keydown', onKeyDown))

  return (
    <Show when={props.isOpen}>
      <div class="modal-backdrop" onClick={props.onClose}>
        <div class="modal-dialog settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
          <header class="modal-header">
            <div class="modal-title-wrap">
              <SettingsIcon size={17} class="text-blue-400" />
              <h2 class="modal-title">Settings</h2>
            </div>
            <button class="modal-close-btn" onClick={props.onClose} title="Close (Esc)">
              <XIcon size={16} />
            </button>
          </header>

          <div class="modal-body settings-body">
            <Show when={status()} fallback={<div class="settings-loading">Loading…</div>}>
              {(s) => (
                <>
                  <div class="settings-section">
                    <div class="settings-row">
                      <div class="settings-row-text">
                        <span class="settings-row-title">MCP Server</span>
                        <span class="settings-row-desc">
                          Lets external AI tools (Claude Desktop, Cursor, VS Code, ...) search, tag, and
                          export sounds in this library over a local, token-authenticated connection.
                        </span>
                      </div>
                      <button
                        type="button"
                        class="settings-switch"
                        classList={{ on: s().enabled }}
                        disabled={busy()}
                        onClick={toggleMcp}
                        title={s().enabled ? 'Turn off MCP server' : 'Turn on MCP server'}
                      >
                        <span class="settings-switch-thumb" />
                      </button>
                    </div>

                    <Show when={s().enabled}>
                      <div class="settings-mcp-status">
                        {busy() ? (
                          <span class="settings-status-pill">
                            <RefreshCwIcon size={11} class="animate-spin" /> Applying…
                          </span>
                        ) : s().running ? (
                          <span class="settings-status-pill status-ok">
                            <CheckCircleIcon size={11} /> Running
                          </span>
                        ) : (
                          <span class="settings-status-pill status-warn">Failed to start — check logs</span>
                        )}
                      </div>

                      <Show when={s().running && s().url && s().token}>
                        <div class="settings-field">
                          <label class="settings-field-label">Connection URL</label>
                          <div class="settings-copy-row">
                            <input type="text" class="settings-copy-input" readonly value={s().url ?? ''} />
                            <button
                              type="button"
                              class="settings-copy-btn"
                              onClick={() => copy('url', s().url ?? '')}
                              title="Copy URL"
                            >
                              {copiedField() === 'url' ? <CheckCircleIcon size={13} /> : <CopyIcon size={13} />}
                            </button>
                          </div>
                        </div>

                        <div class="settings-field">
                          <label class="settings-field-label">Bearer Token</label>
                          <div class="settings-copy-row">
                            <input
                              type={showToken() ? 'text' : 'password'}
                              class="settings-copy-input tabular"
                              readonly
                              value={s().token ?? ''}
                            />
                            <button
                              type="button"
                              class="settings-copy-btn"
                              onClick={() => setShowToken((v) => !v)}
                              title={showToken() ? 'Hide token' : 'Show token'}
                            >
                              {showToken() ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                            </button>
                            <button
                              type="button"
                              class="settings-copy-btn"
                              onClick={() => copy('token', s().token ?? '')}
                              title="Copy token"
                            >
                              {copiedField() === 'token' ? <CheckCircleIcon size={13} /> : <CopyIcon size={13} />}
                            </button>
                          </div>
                          <p class="settings-field-hint">
                            Regenerated on every app launch. Paste the URL and token into your MCP host's
                            config (e.g. as a Bearer <code>Authorization</code> header).
                          </p>
                        </div>
                      </Show>
                    </Show>
                  </div>
                </>
              )}
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
