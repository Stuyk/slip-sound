import { onMount, onCleanup, Show } from 'solid-js'
import {
  XIcon,
  HelpCircleIcon,
  KeyboardIcon,
  MousePointerIcon,
  GripVerticalIcon,
  WaveformIcon,
  FileAudioIcon,
  ArrowRightIcon
} from './icons'

export default function HelpModal(props: { isOpen: boolean; onClose: () => void }) {
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && props.isOpen) {
      e.preventDefault()
      props.onClose()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown)
  })

  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <Show when={props.isOpen}>
      <div class="modal-backdrop" onClick={props.onClose}>
        <div class="modal-dialog help-dialog" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <header class="modal-header">
            <div class="modal-title-wrap">
              <HelpCircleIcon size={18} class="text-blue-400" />
              <h2 class="modal-title">SlipSound Quick Guide & Hotkeys</h2>
            </div>
            <button class="modal-close-btn" onClick={props.onClose} title="Close guide (Esc)">
              <XIcon size={16} />
            </button>
          </header>

          {/* Modal Scrollable Body */}
          <div class="modal-body help-body">
            {/* Grid 2x2 of Key Topics */}
            <div class="help-sections-grid">
              {/* Card 1: Keyboard Hotkeys */}
              <div class="help-card">
                <div class="help-card-header">
                  <KeyboardIcon size={16} class="text-blue-400" />
                  <h3>Keyboard Navigation & Playback</h3>
                </div>
                <p class="help-card-desc">Navigate and audition sounds rapidly without touching your mouse.</p>

                <div class="shortcut-rows">
                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>Space</kbd>
                    </div>
                    <span class="shortcut-action">Play / Pause active sound or selected region</span>
                  </div>

                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>↑</kbd> <kbd>↓</kbd>
                    </div>
                    <span class="shortcut-action">Select previous / next sound in list</span>
                  </div>

                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>Home</kbd> <kbd>End</kbd>
                    </div>
                    <span class="shortcut-action">Jump to top or bottom of library</span>
                  </div>

                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>A</kbd>
                    </div>
                    <span class="shortcut-action">Select all sounds matching the current filters</span>
                  </div>

                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>F</kbd>
                    </div>
                    <span class="shortcut-action">Instant focus and select search bar</span>
                  </div>

                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>O</kbd>
                    </div>
                    <span class="shortcut-action">Open folder picker dialog</span>
                  </div>

                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>E</kbd>
                    </div>
                    <span class="shortcut-action">Open export dialog for selected sound(s)</span>
                  </div>

                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>B</kbd>
                    </div>
                    <span class="shortcut-action">Toggle Categories explorer sidebar</span>
                  </div>

                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>Alt</kbd>+<kbd>A</kbd>
                    </div>
                    <span class="shortcut-action">Toggle Auto-play on select ON / OFF</span>
                  </div>

                  <div class="shortcut-row">
                    <div class="shortcut-keys">
                      <kbd>?</kbd>
                    </div>
                    <span class="shortcut-action">Toggle this guide</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Multi-Selection & Shift Select */}
              <div class="help-card">
                <div class="help-card-header">
                  <MousePointerIcon size={16} class="text-amber-400" />
                  <h3>Selecting Multiple & Shift Select</h3>
                </div>
                <p class="help-card-desc">Batch select files for dragging or inspecting total size.</p>

                <div class="help-visual-box">
                  <div class="visual-select-list">
                    <div class="visual-row selected">
                      <FileAudioIcon size={13} class="text-blue-300" />
                      <span>impact_heavy_01.wav</span>
                      <span class="visual-pill active">Active</span>
                    </div>
                    <div class="visual-row in-range">
                      <FileAudioIcon size={13} class="text-amber-300" />
                      <span>impact_heavy_02.wav</span>
                      <span class="visual-pill range">Range</span>
                    </div>
                    <div class="visual-row in-range">
                      <FileAudioIcon size={13} class="text-amber-300" />
                      <span>impact_heavy_03.wav</span>
                      <span class="visual-pill range">Shift + Click</span>
                    </div>
                  </div>
                </div>

                <div class="help-bullet-list">
                  <div class="help-bullet-item">
                    <strong>Click:</strong> Selects a single sound (plays if auto-play is enabled).
                  </div>
                  <div class="help-bullet-item">
                    <strong>Double-Click:</strong> Always plays sound immediately, even when auto-play is off.
                  </div>
                  <div class="help-bullet-item">
                    <strong>Shift + Click:</strong> Range selection! Selects all sounds between the active row and the clicked row.
                  </div>
                  <div class="help-bullet-item">
                    <strong>Ctrl / Cmd + Click:</strong> Toggle individual sounds in and out of the multi-selection.
                  </div>
                </div>
              </div>

              {/* Card 3: Drag & Drop into DAWs / Audacity */}
              <div class="help-card">
                <div class="help-card-header">
                  <GripVerticalIcon size={16} class="text-emerald-400" />
                  <h3>Drag & Drop into External Apps</h3>
                </div>
                <p class="help-card-desc">Drop audio directly into your production timeline.</p>

                {/* Visual Drag Diagram */}
                <div class="help-visual-box">
                  <div class="visual-drag-flow">
                    <div class="visual-source-card">
                      <GripVerticalIcon size={14} class="text-zinc-400" />
                      <FileAudioIcon size={14} class="text-blue-400" />
                      <span>Sound / Multi-Select</span>
                    </div>

                    <div class="visual-arrow">
                      <span class="visual-arrow-label">Drag Out</span>
                      <ArrowRightIcon size={16} class="text-blue-400" />
                    </div>

                    <div class="visual-target-card">
                      <span class="target-app">Audacity</span>
                      <span class="target-app">Reaper / FL Studio</span>
                      <span class="target-app">Ableton / File Explorer</span>
                    </div>
                  </div>
                </div>

                <div class="help-bullet-list">
                  <div class="help-bullet-item">
                    <strong>Direct DAW Drop:</strong> Grab any row (or the <GripVerticalIcon size={11} class="inline" /> handle) and drag straight into Audacity, Reaper, FL Studio, Ableton, Premiere Pro, or file explorer windows.
                  </div>
                  <div class="help-bullet-item">
                    <strong>Batch Export:</strong> When multiple sounds are selected, dragging any one of them exports the entire batch at once!
                  </div>
                </div>
              </div>

              {/* Card 4: Waveform Slicing & Region Export */}
              <div class="help-card">
                <div class="help-card-header">
                  <WaveformIcon size={16} class="text-amber-400" />
                  <h3>Waveform Slicing & Region Export</h3>
                </div>
                <p class="help-card-desc">Extract a snippet from a longer sound without leaving the app.</p>

                {/* Visual Waveform Region Diagram */}
                <div class="help-visual-box">
                  <div class="visual-waveform-preview">
                    <div class="visual-wave-bar wave-played" style={{ height: '35%' }} />
                    <div class="visual-wave-bar wave-played" style={{ height: '65%' }} />
                    <div class="visual-wave-bar wave-region" style={{ height: '90%' }}>
                      <span class="visual-region-tag">Selected Region</span>
                    </div>
                    <div class="visual-wave-bar wave-region" style={{ height: '80%' }} />
                    <div class="visual-wave-bar wave-region" style={{ height: '45%' }} />
                    <div class="visual-wave-bar" style={{ height: '25%' }} />
                    <div class="visual-wave-bar" style={{ height: '15%' }} />
                  </div>
                </div>

                <div class="help-bullet-list">
                  <div class="help-bullet-item">
                    <strong>Click to Seek:</strong> Click anywhere on the waveform canvas to jump playback immediately.
                  </div>
                  <div class="help-bullet-item">
                    <strong>Drag to Select Region:</strong> Click & drag across any slice of audio to highlight a region.
                  </div>
                  <div class="help-bullet-item">
                    <strong>Loop / Preview Slice:</strong> Press <kbd>Space</kbd> to listen to only the selected region.
                  </div>
                  <div class="help-bullet-item">
                    <strong>Export Snippet:</strong> Click <strong>Export Region</strong> to save just the trimmed slice as a fresh WAV or OGG file at your chosen sample rate.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <footer class="modal-footer">
            <span class="modal-hint">Press <kbd>Esc</kbd> or click outside to dismiss</span>
            <button class="btn-flat btn-primary" onClick={props.onClose}>
              Got It
            </button>
          </footer>
        </div>
      </div>
    </Show>
  )
}
