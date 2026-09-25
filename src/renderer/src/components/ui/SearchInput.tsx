import { TextInput } from './TextInput';
import { Search, X } from 'lucide-solid';

export interface SearchInputProps {
  id?: string;
  value: string;
  onInput: (val: string) => void;
  placeholder?: string;
  count?: { current: number; total: number };
  onClear?: () => void;
  class?: string;
  ref?: HTMLInputElement | ((el: HTMLInputElement) => void);
  autofocus?: boolean;
}

export function SearchInput(props: SearchInputProps) {
  return (
    <div class={`relative ${props.class || ''}`}>
      <TextInput
        id={props.id}
        ref={props.ref}
        autofocus={props.autofocus}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        placeholder={props.placeholder || 'Filter items...'}
        prefix={<Search size={13} class="text-[#8b949e]" />}
        suffix={
          <div class="flex items-center gap-1.5">
            {props.count && (
              <span class="text-md font-mono text-[#8b949e] bg-[#26282b] px-2 py-0.5 rounded-[2px] border border-[#1c1d1f]">
                {props.count.current}/{props.count.total}
              </span>
            )}
            {props.value && (
              <button
                type="button"
                onClick={() => {
                  props.onInput('');
                  props.onClear?.();
                }}
                class="hover:text-white text-[#8b949e] transition-colors p-0.5"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        }
      />
    </div>
  );
}
