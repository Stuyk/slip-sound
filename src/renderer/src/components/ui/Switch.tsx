import { JSX, mergeProps } from 'solid-js';

export interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: JSX.Element;
  disabled?: boolean;
  class?: string;
}

export function Switch(rawProps: SwitchProps): JSX.Element {
  const props = mergeProps({ checked: false, disabled: false }, rawProps);

  return (
    <label
      id={props.id ? `${props.id}-container` : undefined}
      class={`inline-flex items-center justify-between gap-2 cursor-pointer select-none text-md text-[var(--text-main)] ${
        props.disabled ? 'opacity-40 pointer-events-none' : ''
      } ${props.class || ''}`}
    >
      {props.label && <span>{props.label}</span>}
      <button
        id={props.id}
        type="button"
        role="switch"
        aria-checked={props.checked}
        onClick={() => props.onChange?.(!props.checked)}
        class={`inline-flex h-4 w-7 shrink-0 items-center p-[2px] rounded-full border transition-colors focus:outline-none ${
          props.checked
            ? 'justify-end bg-[var(--accent-color)] border-[var(--accent-color)]'
            : 'justify-start bg-[var(--bg-input)] border-[#4a4e55] hover:border-[#8b949e]'
        }`}
      >
        <span class={`block h-2.5 w-2.5 rounded-full ${props.checked ? 'bg-white' : 'bg-[#8b949e]'}`} />
      </button>
    </label>
  );
}
