import { JSX, mergeProps, splitProps } from 'solid-js';

export interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tooltip?: string;
  children: JSX.Element;
}

export function IconButton(rawProps: IconButtonProps) {
  const props = mergeProps({ size: 'sm', active: false }, rawProps);
  const [, rest] = splitProps(props, ['active', 'size', 'tooltip', 'children', 'class']);

  const sizeClasses = {
    xs: 'w-7 h-7 min-w-[28px] min-h-[28px] text-md',
    sm: 'w-8 h-8 min-w-[32px] min-h-[32px] text-md',
    md: 'w-9 h-9 min-w-[36px] min-h-[36px] text-md',
    lg: 'w-10 h-10 min-w-[40px] min-h-[40px] text-md',
  }[props.size];

  return (
    <button
      type="button"
      title={props.tooltip}
      class={`inline-flex items-center justify-center transition-all select-none border rounded-[3px] focus:outline-none focus:ring-1 focus:ring-[#007acc] cursor-pointer ${sizeClasses} ${
        props.active
          ? 'bg-[#007acc] text-white border-[#005f9e] shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] font-semibold'
          : 'bg-[#383b40] hover:bg-[#444850] active:bg-[#2c2e33] text-[#f0f3f6] border-[#1c1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]'
      } ${rawProps.class || ''}`}
      {...rest}
    >
      {props.children}
    </button>
  );
}
