import { For, Show } from 'solid-js';
import type { RecentEntry } from '../../../../preload/index';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Kbd } from '../ui/Kbd';
import {
  FolderOpenIcon,
  DatabaseIcon,
  FileAudioIcon,
  Trash2Icon,
} from '../icons';

export interface WelcomeScreenProps {
  onPickFolder: () => void;
  recent: RecentEntry[];
  onOpenRecent: (folder: string) => void;
  onRemoveRecent: (folder: string, e: MouseEvent) => void;
  appIcon: string;
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  return (
    <div id="welcome-screen" class="flex-1 flex flex-col items-center justify-center p-8 bg-[#2b2d30] text-center select-none overflow-y-auto dcc-scroll">
      <div id="welcome-card" class="max-w-md w-full flex flex-col items-center gap-5">
        <img id="welcome-app-icon" src={props.appIcon} alt="SlipSound" class="w-20 h-20 drop-shadow-md select-none" />

        <div id="welcome-header" class="flex flex-col gap-1.5">
          <h2 id="welcome-title" class="text-xl font-bold tracking-tight text-[#f0f3f6]">SlipSound Audio Workstation</h2>
          <p id="welcome-desc" class="text-md text-[#8b949e] leading-relaxed">
            Fast, high-density local sound browser with waveform audition, region export, and DAW drag-and-drop.
          </p>
        </div>

        <Button
          id="welcome-btn-choose-folder"
          variant="primary"
          size="md"
          onClick={props.onPickFolder}
          icon={<FolderOpenIcon size={16} />}
        >
          <span>Choose Sound Folder</span>
        </Button>

        {/* Recent Databases List */}
        <Show when={props.recent.length > 0}>
          <div id="welcome-recent-databases" class="w-full bg-[#1e2022] border border-[#1c1d1f] rounded-[3px] p-2.5 flex flex-col gap-1.5 text-left">
            <div id="welcome-recent-header" class="flex items-center gap-2 text-md font-semibold uppercase tracking-wider text-[#8b949e] px-1 pb-1 border-b border-[#1c1d1f]">
              <DatabaseIcon size={12} class="text-[#007acc]" />
              <span>Recent Databases</span>
            </div>
            <div id="welcome-recent-list" class="flex flex-col gap-1 max-h-48 overflow-y-auto dcc-scroll pr-1">
              <For each={props.recent}>
                {(entry, i) => (
                  <div
                    id={`welcome-recent-entry-${i()}`}
                    class="flex items-center justify-between px-2 py-1.5 rounded-[2px] hover:bg-white/5 cursor-pointer text-md text-[#f0f3f6] transition-colors group"
                    onClick={() => props.onOpenRecent(entry.folder)}
                  >
                    <div class="flex items-center gap-2 truncate min-w-0" title={entry.folder}>
                      <FileAudioIcon size={14} class="text-[#8b949e] shrink-0" />
                      <span class="truncate">{entry.folder}</span>
                    </div>
                    <IconButton
                      id={`welcome-recent-remove-btn-${i()}`}
                      size="xs"
                      tooltip="Remove from recents"
                      onClick={(e) => props.onRemoveRecent(entry.folder, e)}
                    >
                      <Trash2Icon size={12} />
                    </IconButton>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Keyboard Shortcuts Guide */}
        <div id="welcome-shortcuts-guide" class="w-full grid grid-cols-2 gap-2 text-md text-[#8b949e] pt-2 border-t border-[#1c1d1f]">
          <div id="welcome-shortcut-play" class="flex items-center justify-between px-2.5 py-1.5 bg-[#1e2022] rounded-[2px] border border-[#1c1d1f]">
            <span>Play / Pause</span>
            <Kbd>Space</Kbd>
          </div>
          <div id="welcome-shortcut-navigate" class="flex items-center justify-between px-2.5 py-1.5 bg-[#1e2022] rounded-[2px] border border-[#1c1d1f]">
            <span>Navigate</span>
            <div class="flex gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd></div>
          </div>
          <div id="welcome-shortcut-multiselect" class="flex items-center justify-between px-2.5 py-1.5 bg-[#1e2022] rounded-[2px] border border-[#1c1d1f]">
            <span>Multi-Select</span>
            <div class="flex gap-1"><Kbd>Ctrl</Kbd><span>+ Click</span></div>
          </div>
          <div id="welcome-shortcut-drag" class="flex items-center justify-between px-2.5 py-1.5 bg-[#1e2022] rounded-[2px] border border-[#1c1d1f]">
            <span>Drag to DAW</span>
            <span class="text-[#007acc] font-mono text-md">Drag Row</span>
          </div>
        </div>
      </div>
    </div>
  );
}
