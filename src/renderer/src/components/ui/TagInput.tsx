import { createSignal, For } from 'solid-js';
import { X, Plus } from 'lucide-solid';

export interface TagInputProps {
  label?: string;
  tags?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  class?: string;
}

export function TagInput(props: TagInputProps) {
  const [tags, setTags] = createSignal<string[]>(props.tags || ['Hero_Asset', 'PBR', 'LOD0', 'HighPoly']);
  const [inputValue, setInputValue] = createSignal('');

  const addTag = () => {
    const val = inputValue().trim().replace(/ /g, '_');
    if (val && !tags().includes(val)) {
      const next = [...tags(), val];
      setTags(next);
      props.onChange?.(next);
      setInputValue('');
    }
  };

  const removeTag = (tag: string) => {
    const next = tags().filter((t) => t !== tag);
    setTags(next);
    props.onChange?.(next);
  };

  return (
    <div class={`space-y-1 select-none ${props.class || ''}`}>
      {props.label && (
        <span class="text-md text-[var(--text-muted)] font-mono uppercase block">
          {props.label}
        </span>
      )}

      <div class="flex flex-wrap items-center gap-1 p-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[2px] min-h-7">
        <For each={tags()}>
          {(tag) => (
            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-white/10 text-white font-mono text-md">
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                class="hover:text-red-400 transition-colors"
              >
                <X size={9} />
              </button>
            </span>
          )}
        </For>

        <div class="flex items-center gap-1 flex-1 min-w-[80px]">
          <input
            type="text"
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder={props.placeholder || 'Add tag...'}
            class="w-full bg-transparent text-md text-white focus:outline-none placeholder:text-gray-600 font-mono px-1"
          />
          <button
            type="button"
            onClick={addTag}
            class="text-[var(--text-muted)] hover:text-white p-0.5"
            title="Add tag"
          >
            <Plus size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
