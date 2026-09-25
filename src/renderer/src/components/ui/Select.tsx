import { mergeProps } from 'solid-js';
import { ChevronDown } from 'lucide-solid';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id?: string;
  value: string;
  options: SelectOption[] | string[];
  onChange?: (val: string) => void;
  disabled?: boolean;
  class?: string;
}

export function Select(rawProps: SelectProps) {
  const props = mergeProps({ disabled: false }, rawProps);

  const normalizedOptions = () => {
    return props.options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
  };

  return (
    <div
      class={`relative inline-flex items-center h-8 min-h-[32px] bg-[#1e2022] border border-[#1c1d1f] hover:border-[#383b40] focus-within:border-[#007acc] focus-within:ring-1 focus-within:ring-[#007acc] text-[#f0f3f6] text-md transition-colors rounded-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] ${
        props.disabled ? 'opacity-40 pointer-events-none' : ''
      } ${props.class || ''}`}
    >
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange?.(e.currentTarget.value)}
        disabled={props.disabled}
        class="w-full h-full bg-transparent appearance-none pl-3 pr-8 text-md text-[#f0f3f6] focus:outline-none cursor-pointer"
      >
        {normalizedOptions().map((opt) => (
          <option value={opt.value} class="bg-[#26282b] text-[#f0f3f6]">
            {opt.label}
          </option>
        ))}
      </select>
      <span class="absolute right-2 pointer-events-none text-[#8b949e]">
        <ChevronDown size={13} />
      </span>
    </div>
  );
}
