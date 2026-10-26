import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Kbd } from './ui/Kbd';
import {
  HelpCircle,
  Keyboard,
  MousePointer,
  GripVertical,
  AudioWaveform,
  FileAudio,
  ArrowRight,
} from 'lucide-solid';

export default function HelpModal(props: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal
      id="help-modal"
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="SlipSound Quick Guide & Hotkeys"
      icon={<HelpCircle size={15} />}
      width="780px"
      footer={
        <div id="help-modal-footer" class="w-full flex items-center justify-between">
          <span class="text-md text-[var(--text-muted)] font-mono">
            Press <Kbd>Esc</Kbd> or click outside to dismiss
          </span>
          <Button id="help-modal-btn-got-it" variant="primary" size="sm" onClick={props.onClose}>
            Got It
          </Button>
        </div>
      }
    >
      <div id="help-modal-content-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3 text-md">
        {/* Card 1: Keyboard Hotkeys */}
        <div id="help-card-hotkeys" class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-2">
          <div class="flex items-center gap-1.5 font-bold text-md text-[var(--text-main)]">
            <Keyboard size={14} class="text-[var(--accent-color)] shrink-0" />
            <span>Keyboard Navigation & Playback</span>
          </div>
          <p class="text-md text-[var(--text-muted)]">
            Audition sounds and navigate rapidly without leaving the keyboard.
          </p>

          <div class="flex flex-col gap-1.5 mt-1 font-mono text-md">
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Play / Pause</span>
              <Kbd>Space</Kbd>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Next / Previous Sound</span>
              <div class="flex gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Jump Top / Bottom</span>
              <div class="flex gap-1"><Kbd>Home</Kbd><Kbd>End</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Select All Filtered</span>
              <div class="flex gap-1"><Kbd>Ctrl</Kbd>+<Kbd>A</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Focus Search</span>
              <div class="flex gap-1"><Kbd>Ctrl</Kbd>+<Kbd>F</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Open Sound Folder</span>
              <div class="flex gap-1"><Kbd>Ctrl</Kbd>+<Kbd>O</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Export Selection</span>
              <div class="flex gap-1"><Kbd>Ctrl</Kbd>+<Kbd>E</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Slice Sound Into Files</span>
              <div class="flex gap-1"><Kbd>Ctrl</Kbd>+<Kbd>K</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Make Seamless Loop</span>
              <div class="flex gap-1"><Kbd>Ctrl</Kbd>+<Kbd>L</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Toggle Categories Sidebar</span>
              <div class="flex gap-1"><Kbd>Ctrl</Kbd>+<Kbd>B</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5 border-b border-[var(--border-color)]/50">
              <span class="text-[var(--text-main)]">Toggle Auto-Play</span>
              <div class="flex gap-1"><Kbd>Alt</Kbd>+<Kbd>A</Kbd></div>
            </div>
            <div class="flex items-center justify-between py-0.5">
              <span class="text-[var(--text-main)]">Toggle Guide</span>
              <Kbd>?</Kbd>
            </div>
          </div>
        </div>

        {/* Card 2: Multi-Selection & Range Select */}
        <div class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-2">
          <div class="flex items-center gap-1.5 font-bold text-md text-[var(--text-main)]">
            <MousePointer size={14} class="text-[var(--accent-color)] shrink-0" />
            <span>Multi-Select & Range Selection</span>
          </div>
          <p class="text-md text-[var(--text-muted)]">
            Batch select audio files for bulk operations and dragging into your DAW.
          </p>

          <div class="bg-black/30 border border-[var(--border-color)] rounded-[2px] p-2 flex flex-col gap-1 font-mono text-md">
            <div class="flex items-center justify-between px-1.5 py-0.5 rounded bg-[var(--accent-color)]/20 text-[var(--accent-color)]">
              <div class="flex items-center gap-1.5">
                <FileAudio size={12} />
                <span>sound_kick_01.wav</span>
              </div>
              <span class="text-md uppercase font-bold">Active</span>
            </div>
            <div class="flex items-center justify-between px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-main)]">
              <div class="flex items-center gap-1.5">
                <FileAudio size={12} class="opacity-60" />
                <span>sound_kick_02.wav</span>
              </div>
              <span class="text-md text-[var(--text-muted)]">In Range</span>
            </div>
            <div class="flex items-center justify-between px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-main)]">
              <div class="flex items-center gap-1.5">
                <FileAudio size={12} class="opacity-60" />
                <span>sound_kick_03.wav</span>
              </div>
              <span class="text-md text-[var(--accent-color)]">Shift+Click</span>
            </div>
          </div>

          <div class="flex flex-col gap-1 text-md text-[var(--text-muted)] mt-1">
            <div><strong class="text-[var(--text-main)]">Click:</strong> Select single sound (auto-plays if enabled).</div>
            <div><strong class="text-[var(--text-main)]">Double-Click:</strong> Always plays sound immediately.</div>
            <div><strong class="text-[var(--text-main)]">Shift + Click:</strong> Selects a contiguous range of sounds.</div>
            <div><strong class="text-[var(--text-main)]">Ctrl / Cmd + Click:</strong> Toggles individual sounds in/out of selection.</div>
          </div>
        </div>

        {/* Card 3: Drag & Drop into DAWs */}
        <div class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-2">
          <div class="flex items-center gap-1.5 font-bold text-md text-[var(--text-main)]">
            <GripVertical size={14} class="text-[var(--accent-color)] shrink-0" />
            <span>Drag & Drop External Export</span>
          </div>
          <p class="text-md text-[var(--text-muted)]">
            Drop audio directly onto timeline tracks in any digital audio workstation.
          </p>

          <div class="bg-black/30 border border-[var(--border-color)] rounded-[2px] p-2 flex items-center justify-between font-mono text-md">
            <div class="flex items-center gap-1.5 text-[var(--accent-color)]">
              <FileAudio size={13} />
              <span>Selection</span>
            </div>
            <div class="flex items-center gap-1 text-[var(--text-muted)] text-md uppercase">
              <span>Drag Out</span>
              <ArrowRight size={11} />
            </div>
            <div class="text-[var(--text-main)] text-md">
              Ableton • FL • Reaper • DAW
            </div>
          </div>

          <div class="flex flex-col gap-1 text-md text-[var(--text-muted)] mt-1">
            <div><strong class="text-[var(--text-main)]">Direct Drop:</strong> Drag any selected row directly into Ableton, FL Studio, Reaper, Premiere, or File Explorer.</div>
            <div><strong class="text-[var(--text-main)]">Batch Drag:</strong> When multiple sounds are selected, dragging any one drags the full batch!</div>
          </div>
        </div>

        {/* Card 4: Waveform Slicing & Region Export */}
        <div class="bg-black/20 border border-[var(--border-color)] rounded-[3px] p-3 flex flex-col gap-2">
          <div class="flex items-center gap-1.5 font-bold text-md text-[var(--text-main)]">
            <AudioWaveform size={14} class="text-[var(--accent-color)] shrink-0" />
            <span>Waveform Slicing & Region Export</span>
          </div>
          <p class="text-md text-[var(--text-muted)]">
            Extract snippets and loop subsections without leaving SlipSound.
          </p>

          <div class="bg-black/30 border border-[var(--border-color)] rounded-[2px] p-2 flex items-end justify-center gap-1 h-12">
            <div class="w-2 bg-white/20 h-4 rounded-xs" />
            <div class="w-2 bg-white/20 h-7 rounded-xs" />
            <div class="w-2 bg-[var(--accent-color)] h-10 rounded-xs" />
            <div class="w-2 bg-[var(--accent-color)] h-9 rounded-xs" />
            <div class="w-2 bg-[var(--accent-color)] h-6 rounded-xs" />
            <div class="w-2 bg-white/20 h-3 rounded-xs" />
          </div>

          <div class="flex flex-col gap-1 text-md text-[var(--text-muted)] mt-1">
            <div><strong class="text-[var(--text-main)]">Click to Seek:</strong> Click anywhere on the waveform to seek immediately.</div>
            <div><strong class="text-[var(--text-main)]">Drag Selection:</strong> Drag across audio to slice a region.</div>
            <div><strong class="text-[var(--text-main)]">Region Export:</strong> Click Export Region to convert and save only the highlighted slice.</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
