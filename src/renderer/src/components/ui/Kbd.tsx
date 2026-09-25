import { JSX } from 'solid-js';

export interface KbdProps {
  children: JSX.Element;
  class?: string;
}

export function Kbd(props: KbdProps) {
  return (
    <kbd
      class={`inline-flex items-center justify-center px-2 py-0.5 text-md font-mono font-semibold text-gray-200 bg-[#1e2022] border border-[#1c1d1f] rounded-[3px] shadow-xs select-none ${
        props.class || ''
      }`}
    >
      {props.children}
    </kbd>
  );
}
