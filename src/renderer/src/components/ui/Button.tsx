import { JSX, mergeProps, splitProps } from 'solid-js';

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'outline' | 'accent';
  size?: 'xs' | 'sm' | 'md';
  active?: boolean;
  icon?: JSX.Element;
  children?: JSX.Element;
}

export function Button(rawProps: ButtonProps) {
  const props = mergeProps({ variant: 'default', size: 'sm', active: false }, rawProps);
  const [, rest] = splitProps(props, ['variant', 'size', 'active', 'icon', 'children', 'class']);

  const sizeClasses = {
    xs: 'h-7 min-h-[28px] px-2.5 text-md gap-1',
    sm: 'h-8 min-h-[32px] px-3.5 text-md gap-1.5',
    md: 'h-9 min-h-[36px] px-4 text-md gap-2',
  }[props.size];

  const variantClasses = () => {
    if (props.active) {
      return 'bg-[#007acc] text-white border border-[#005f9e] shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] font-semibold';
    }
    switch (props.variant) {
      case 'primary':
        return 'bg-[#007acc] hover:bg-[#0088e0] active:bg-[#0062a3] text-white border border-[#005f9e] shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] font-semibold';
      case 'ghost':
        return 'bg-transparent hover:bg-white/10 active:bg-black/20 text-[#f0f3f6] border border-transparent';
      case 'outline':
        return 'bg-transparent hover:bg-[#383b40] text-[#f0f3f6] border border-[#1c1d1f] hover:border-[#2a2d32]';
      case 'accent':
        return 'bg-[#007acc] hover:bg-[#0088e0] active:bg-[#0062a3] text-white border border-[#005f9e] shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] font-semibold';
      case 'default':
      default:
        return 'bg-[#383b40] hover:bg-[#444850] active:bg-[#2c2e33] text-[#f0f3f6] border border-[#1c1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]';
    }
  };

  return (
    <button
      type="button"
      class={`inline-flex items-center justify-center font-medium transition-all select-none rounded-[3px] focus:outline-none focus:ring-1 focus:ring-[#007acc] disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${sizeClasses} ${variantClasses()} ${rawProps.class || ''}`}
      {...rest}
    >
      {props.icon && <span class="shrink-0 flex items-center">{props.icon}</span>}
      {props.children && <span>{props.children}</span>}
    </button>
  );
}
