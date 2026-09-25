import { JSX, mergeProps, splitProps } from 'solid-js';

export interface TextInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: JSX.Element;
  suffix?: JSX.Element;
}

export function TextInput(rawProps: TextInputProps) {
  const props = mergeProps({ type: 'text' }, rawProps);
  const [, rest] = splitProps(props, ['prefix', 'suffix', 'class']);

  return (
    <div
      class={`flex items-center h-8 min-h-[32px] bg-[#1e2022] border border-[#1c1d1f] focus-within:border-[#007acc] focus-within:ring-1 focus-within:ring-[#007acc] px-2.5 gap-2 transition-colors rounded-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] ${
        rawProps.class || ''
      }`}
    >
      {props.prefix && <span class="text-[#8b949e] text-md shrink-0 flex items-center">{props.prefix}</span>}
      <input
        class="w-full bg-transparent text-[#f0f3f6] text-md placeholder:text-[#8b949e]/60 focus:outline-none"
        {...rest}
      />
      {props.suffix && <span class="text-[#8b949e] text-md shrink-0 flex items-center">{props.suffix}</span>}
    </div>
  );
}
