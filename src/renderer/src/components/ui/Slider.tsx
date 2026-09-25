import { createSignal, mergeProps, onCleanup } from 'solid-js';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  onChange?: (val: number) => void;
  class?: string;
}

export function Slider(rawProps: SliderProps) {
  const props = mergeProps({ min: 0, max: 1, step: 0.01, showValue: true }, rawProps);
  const [isDragging, setIsDragging] = createSignal(false);

  let trackRef: HTMLDivElement | undefined;

  const percentage = () => {
    const range = props.max - props.min;
    if (range === 0) return 0;
    return Math.min(100, Math.max(0, ((props.value - props.min) / range) * 100));
  };

  const updateFromPosition = (clientX: number) => {
    if (!trackRef) return;
    const rect = trackRef.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const val = props.min + ratio * (props.max - props.min);
    const stepped = Math.round(val / props.step) * props.step;
    const rounded = Number(stepped.toFixed(3));
    props.onChange?.(rounded);
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    updateFromPosition(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateFromPosition(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  onCleanup(() => {
    setIsDragging(false);
  });

  return (
    <div class={`w-full flex flex-col gap-1 select-none ${props.class || ''}`}>
      {(props.label || props.showValue) && (
        <div class="flex justify-between items-center text-md">
          {props.label && <span class="text-[var(--text-main)] truncate">{props.label}</span>}
          {props.showValue && (
            <span class="font-mono text-[var(--accent-color)] text-md ml-auto">
              {props.value.toFixed(2)}
            </span>
          )}
        </div>
      )}
      <div
        ref={trackRef}
        class="h-4 flex items-center cursor-pointer relative group"
        onMouseDown={handleMouseDown}
      >
        {/* Track */}
        <div class="w-full h-1.5 bg-black/40 border border-[var(--border-color)] relative rounded-sm overflow-hidden">
          {/* Fill */}
          <div
            class="h-full bg-[var(--accent-color)]/70 group-hover:bg-[var(--accent-color)] transition-colors"
            style={{ width: `${percentage()}%` }}
          />
        </div>
        {/* Thumb */}
        <div
          class="absolute w-2.5 h-3.5 bg-white border border-black/40 shadow-sm top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-[1px] group-hover:scale-110 transition-transform"
          style={{
            left: `${percentage()}%`,
            background: isDragging() ? 'var(--accent-color)' : '#e2e8f0',
          }}
        />
      </div>
    </div>
  );
}
