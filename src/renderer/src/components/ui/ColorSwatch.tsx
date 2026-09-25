import { createSignal } from 'solid-js';

export interface ColorSwatchProps {
  color: string;
  label?: string;
  onChange?: (hex: string) => void;
  class?: string;
}

export function ColorSwatch(props: ColorSwatchProps) {
  const [val, setVal] = createSignal(props.color);

  const handleChange = (newColor: string) => {
    setVal(newColor);
    props.onChange?.(newColor);
  };

  return (
    <div class={`flex items-center justify-between gap-2 ${props.class || ''}`}>
      {props.label && <span class="text-md text-[var(--text-main)] truncate">{props.label}</span>}
      <label class="relative inline-flex items-center cursor-pointer group">
        <div
          class="w-12 h-5 rounded-[2px] border border-[var(--border-color)] group-hover:border-white/40 shadow-inner flex items-center justify-center transition-colors overflow-hidden"
          style={{ "background-color": val() }}
        >
          <input
            type="color"
            value={val()}
            onInput={(e) => handleChange(e.currentTarget.value)}
            class="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
          />
        </div>
        <span class="ml-1.5 font-mono text-md text-[var(--text-muted)] group-hover:text-white uppercase">
          {val()}
        </span>
      </label>
    </div>
  );
}
