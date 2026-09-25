import { JSX, mergeProps } from 'solid-js';
import { Check } from 'lucide-solid';

export interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: JSX.Element;
  disabled?: boolean;
  class?: string;
}

export function Checkbox(rawProps: CheckboxProps) {
  const props = mergeProps({ checked: false, disabled: false }, rawProps);

  return (
    <label
      class={`inline-flex items-center gap-2 cursor-pointer select-none text-md text-[var(--text-main)] ${
        props.disabled ? 'opacity-40 pointer-events-none' : ''
      } ${props.class || ''}`}
    >
      <div
        class={`w-3.5 h-3.5 flex items-center justify-center border transition-all ${
          props.checked
            ? 'bg-[var(--accent-color)] text-[var(--accent-text)] border-[var(--accent-color)]'
            : 'bg-[var(--bg-input)] border-[var(--border-color)] hover:border-white/30'
        }`}
        style={{
          "border-radius": "var(--ui-radius)",
        }}
        onClick={() => props.onChange?.(!props.checked)}
      >
        {props.checked && <Check size={11} strokeWidth={3} />}
      </div>
      {props.label && <span>{props.label}</span>}
    </label>
  );
}
