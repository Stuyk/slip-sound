import { createSignal, onCleanup } from 'solid-js';
import { Command } from 'lucide-solid';

export interface HotkeyRecorderProps {
  label?: string;
  value?: string;
  onChange?: (hotkey: string) => void;
  class?: string;
}

export function HotkeyRecorder(props: HotkeyRecorderProps) {
  const [hotkey, setHotkey] = createSignal(props.value || 'Ctrl + Shift + B');
  const [isRecording, setIsRecording] = createSignal(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isRecording()) return;
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.metaKey) parts.push('Cmd');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      parts.push(e.key.toUpperCase());
      const res = parts.join(' + ');
      setHotkey(res);
      props.onChange?.(res);
      setIsRecording(false);
    }
  };

  const startRecord = () => {
    setIsRecording(true);
    window.addEventListener('keydown', handleKeyDown);
  };

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div class={`space-y-1 select-none ${props.class || ''}`}>
      {props.label && (
        <span class="text-md text-[var(--text-muted)] font-mono uppercase block">
          {props.label}
        </span>
      )}

      <button
        type="button"
        onClick={startRecord}
        class={`w-full h-6 px-2 flex items-center justify-between bg-[var(--bg-input)] border rounded-[2px] font-mono text-md transition-colors ${
          isRecording()
            ? 'border-[var(--accent-color)] ring-1 ring-[var(--accent-color)] text-[var(--accent-color)] animate-pulse'
            : 'border-[var(--border-color)] hover:border-white/30 text-white'
        }`}
      >
        <div class="flex items-center gap-1.5">
          <Command size={10} class="opacity-60" />
          <span>{isRecording() ? 'Press keys now...' : hotkey()}</span>
        </div>
        <span class="text-md opacity-40 uppercase">
          {isRecording() ? 'Esc to cancel' : 'Click to bind'}
        </span>
      </button>
    </div>
  );
}
