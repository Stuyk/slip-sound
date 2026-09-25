import { JSX, mergeProps } from 'solid-js';

export interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: JSX.Element;
  disabled?: boolean;
  class?: string;
}

export function Switch(rawProps: SwitchProps) {
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
        class={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-[var(--border-color)] transition-colors focus:outline-none ${
          props.checked ? 'bg-[var(--accent-color)]' : 'bg-[var(--bg-input)]'
        }`}
      >
        <span
          class={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            props.checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}
