import { Plus, Minus } from 'lucide-solid';

export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  onChange?: (val: number) => void;
  class?: string;
}

export function Stepper(props: StepperProps) {
  const min = props.min ?? 0;
  const max = props.max ?? Infinity;
  const step = props.step ?? 1;

  const decrement = () => {
    const next = Math.max(min, props.value - step);
    props.onChange?.(next);
  };

  const increment = () => {
    const next = Math.min(max, props.value + step);
    props.onChange?.(next);
  };

  return (
    <div class={`flex items-center justify-between h-6 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[2px] px-1 select-none ${props.class || ''}`}>
      {props.label && (
        <span class="text-md font-mono text-[var(--text-muted)] uppercase px-1">
          {props.label}
        </span>
      )}

      <div class="flex items-center gap-1 ml-auto">
        <button
          type="button"
          onClick={decrement}
          disabled={props.value <= min}
          class="w-4 h-4 rounded-[1px] bg-white/5 hover:bg-white/15 flex items-center justify-center text-white disabled:opacity-30"
        >
          <Minus size={9} />
        </button>
        <span class="w-7 text-center font-mono text-md text-white font-bold">
          {props.value}
        </span>
        <button
          type="button"
          onClick={increment}
          disabled={props.value >= max}
          class="w-4 h-4 rounded-[1px] bg-white/5 hover:bg-white/15 flex items-center justify-center text-white disabled:opacity-30"
        >
          <Plus size={9} />
        </button>
      </div>
    </div>
  );
}
