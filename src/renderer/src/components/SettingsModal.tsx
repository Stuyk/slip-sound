import { createSignal, createEffect, Show } from 'solid-js';
import type { McpStatus } from '../../../preload/index';
import { Modal } from './ui/Modal';
import { Switch } from './ui/Switch';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { DragExportSettings } from './DragExportSettings';
import {
  Settings,
  Copy,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Bot,
  Tags,
} from 'lucide-solid';

export default function SettingsModal(props: { isOpen: boolean; onClose: () => void }) {
  const [status, setStatus] = createSignal<McpStatus | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [autoCategorizationEnabled, setAutoCategorizationEnabled] = createSignal(true);
  const [autoCategorizationBusy, setAutoCategorizationBusy] = createSignal(false);
  const [showToken, setShowToken] = createSignal(false);
  const [copiedField, setCopiedField] = createSignal<'url' | 'token' | null>(null);

  async function refresh(): Promise<void> {
    const [mcpStatus, autoCategorization] = await Promise.all([
      window.api.getMcpStatus(),
      window.api.getAutoCategorizationEnabled(),
    ]);
    setStatus(mcpStatus);
    setAutoCategorizationEnabled(autoCategorization);
  }

  async function toggleAutoCategorization(): Promise<void> {
    if (autoCategorizationBusy()) return;
    setAutoCategorizationBusy(true);
    try {
      setAutoCategorizationEnabled(
        await window.api.setAutoCategorizationEnabled(!autoCategorizationEnabled())
      );
    } finally {
      setAutoCategorizationBusy(false);
    }
  }

  createEffect(() => {
    if (props.isOpen) {
      setShowToken(false);
      refresh();
    }
  });

  async function toggleMcp(): Promise<void> {
    const current = status();
    if (!current || busy()) return;
    setBusy(true);
    try {
      setStatus(await window.api.setMcpEnabled(!current.enabled));
    } finally {
      setBusy(false);
    }
  }

  async function copy(field: 'url' | 'token', value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500);
    } catch {
      // clipboard permissions denied
    }
  }

  return (
    <Modal
      id="settings-modal"
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Workstation Settings"
      icon={<Settings size={15} />}
      width="540px"
      footer={
        <div id="settings-modal-footer" class="w-full flex justify-end">
          <Button id="settings-modal-btn-done" variant="default" size="sm" onClick={props.onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div id="settings-modal-content" class="flex flex-col gap-4 text-md">
        {/* Section: Sound Library Automation */}
        <div id="settings-section-auto-categorization" class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-2">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <Tags size={14} class="text-[var(--accent-color)] shrink-0" />
              <div>
                <div class="font-bold text-md text-[var(--text-main)]">Automatic Categorization</div>
                <div class="text-md text-[var(--text-muted)]">
                  Categorize sounds automatically when indexing or re-indexing a library.
                </div>
              </div>
            </div>
            <Switch
              id="settings-toggle-auto-categorization"
              checked={autoCategorizationEnabled()}
              disabled={autoCategorizationBusy()}
              onChange={toggleAutoCategorization}
            />
          </div>
        </div>

        <DragExportSettings />

        {/* Section: MCP AI Server */}
        <div id="settings-section-mcp" class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <Bot size={14} class="text-[var(--accent-color)] shrink-0" />
              <div>
                <div class="font-bold text-md text-[var(--text-main)]">Model Context Protocol (MCP) Server</div>
                <div class="text-md text-[var(--text-muted)]">
                  Connect external AI tools (Claude Desktop, Cursor, Antigravity) to search and tag sounds.
                </div>
              </div>
            </div>
            <Switch
              id="settings-toggle-mcp"
              checked={Boolean(status()?.enabled)}
              disabled={busy()}
              onChange={toggleMcp}
            />
          </div>

          <Show when={status()?.enabled}>
            <div id="settings-mcp-details" class="pt-2 border-t border-[var(--border-color)] flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <span class="text-md font-mono text-[var(--text-muted)] uppercase">Status:</span>
                <Show when={!busy()} fallback={
                  <Badge id="settings-mcp-status-applying" variant="warning">
                    <RefreshCw size={12} class="animate-spin inline mr-1" /> Applying…
                  </Badge>
                }>
                  <Show when={status()?.running} fallback={<Badge id="settings-mcp-status-stopped" variant="error">Stopped</Badge>}>
                    <Badge id="settings-mcp-status-running" variant="success">
                      <CheckCircle2 size={12} class="inline mr-1" /> Running
                    </Badge>
                  </Show>
                </Show>
              </div>

              <Show when={status()?.running && status()?.url && status()?.token}>
                <div class="flex flex-col gap-1 mt-1">
                  <label class="text-md font-mono uppercase text-[var(--text-muted)]">Connection URL</label>
                  <div class="flex items-center h-7 min-h-[28px] bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[2px] px-2 gap-1.5">
                    <input
                      id="settings-mcp-url-input"
                      type="text"
                      class="w-full bg-transparent font-mono text-md text-[var(--text-main)] focus:outline-none"
                      readonly
                      value={status()?.url ?? ''}
                    />
                    <IconButton
                      id="settings-btn-copy-mcp-url"
                      size="xs"
                      tooltip="Copy URL"
                      onClick={() => copy('url', status()?.url ?? '')}
                    >
                      {copiedField() === 'url' ? <CheckCircle2 size={12} class="text-green-400" /> : <Copy size={12} />}
                    </IconButton>
                  </div>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-md font-mono uppercase text-[var(--text-muted)]">Bearer Token</label>
                  <div class="flex items-center h-7 min-h-[28px] bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[2px] px-2 gap-1.5">
                    <input
                      id="settings-mcp-token-input"
                      type={showToken() ? 'text' : 'password'}
                      class="w-full bg-transparent font-mono text-md text-[var(--text-main)] focus:outline-none"
                      readonly
                      value={status()?.token ?? ''}
                    />
                    <IconButton
                      id="settings-btn-toggle-mcp-token"
                      size="xs"
                      tooltip={showToken() ? 'Hide token' : 'Show token'}
                      onClick={() => setShowToken((v) => !v)}
                    >
                      {showToken() ? <EyeOff size={12} /> : <Eye size={12} />}
                    </IconButton>
                    <IconButton
                      id="settings-btn-copy-mcp-token"
                      size="xs"
                      tooltip="Copy token"
                      onClick={() => copy('token', status()?.token ?? '')}
                    >
                      {copiedField() === 'token' ? <CheckCircle2 size={12} class="text-green-400" /> : <Copy size={12} />}
                    </IconButton>
                  </div>
                  <div class="text-md text-[var(--text-muted)] mt-0.5">
                    Regenerated on every launch. Pass as Bearer <code>Authorization</code> header.
                  </div>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Modal>
  );
}
