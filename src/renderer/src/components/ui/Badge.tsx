import { JSX, mergeProps } from 'solid-js';

export interface BadgeProps {
  id?: string;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error';
  children: JSX.Element;
  class?: string;
  title?: string;
}

export function Badge(rawProps: BadgeProps) {
  const props = mergeProps({ variant: 'default' }, rawProps);

  const variantStyles = {
    default: 'bg-white/10 text-[var(--text-main)] border-white/10',
    accent: 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] border-[var(--accent-color)]/40',
    success: 'bg-green-500/20 text-green-400 border-green-500/40',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    error: 'bg-red-500/20 text-red-400 border-red-500/40',
  }[props.variant];

  return (
    <span
      id={props.id}
      title={props.title}
      class={`inline-flex items-center px-2 py-0.5 text-md font-mono font-medium border rounded-[3px] select-none ${variantStyles} ${
        props.class || ''
      }`}
    >
      {props.children}
    </span>
  );
}
