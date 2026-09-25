import { createSignal, onCleanup } from 'solid-js';

export interface RangeSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  label?: string;
  onChange?: (valMin: number, valMax: number) => void;
  class?: string;
}

export function RangeSlider(props: RangeSliderProps) {
  const step = props.step ?? 1;
  const [activeThumb, setActiveThumb] = createSignal<'min' | 'max' | null>(null);

  let trackRef: HTMLDivElement | undefined;

  const getPercent = (val: number) => {
    const range = props.max - props.min;
    if (range === 0) return 0;
    return Math.max(0, Math.min(100, ((val - props.min) / range) * 100));
  };

  const handleMouseDown = (thumb: 'min' | 'max', e: MouseEvent) => {
    e.stopPropagation();
    setActiveThumb(thumb);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!trackRef) return;
      const rect = trackRef.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const rawVal = props.min + ratio * (props.max - props.min);
      const stepped = Math.round(rawVal / step) * step;

      if (thumb === 'min') {
        const clampedMin = Math.min(stepped, props.valueMax);
        props.onChange?.(clampedMin, props.valueMax);
      } else {
        const clampedMax = Math.max(stepped, props.valueMin);
        props.onChange?.(props.valueMin, clampedMax);
      }
    };

    const onMouseUp = () => {
      setActiveThumb(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  onCleanup(() => {
    setActiveThumb(null);
  });

  return (
    <div class={`w-full flex flex-col gap-1 select-none ${props.class || ''}`}>
      <div class="flex justify-between items-center text-md">
        {props.label && <span class="text-[var(--text-main)]">{props.label}</span>}
        <span class="font-mono text-[var(--accent-color)] text-md">
          [{props.valueMin.toFixed(1)} - {props.valueMax.toFixed(1)}]
        </span>
      </div>

      <div ref={trackRef} class="h-4 flex items-center relative cursor-pointer">
        {/* Background Track */}
        <div class="w-full h-1.5 bg-black/40 border border-[var(--border-color)] rounded-sm relative overflow-hidden">
          {/* Active Range Fill */}
          <div
            class="h-full bg-[var(--accent-color)]/80"
            style={{
              left: `${getPercent(props.valueMin)}%`,
              width: `${getPercent(props.valueMax) - getPercent(props.valueMin)}%`,
              position: 'absolute',
            }}
          />
        </div>

        {/* Min Thumb */}
        <div
          class={`absolute w-2.5 h-3.5 bg-white border border-black/50 rounded-[1px] top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize hover:scale-110 transition-transform ${
            activeThumb() === 'min' ? 'ring-1 ring-[var(--accent-color)]' : ''
          }`}
          style={{ left: `${getPercent(props.valueMin)}%` }}
          onMouseDown={(e) => handleMouseDown('min', e)}
        />

        {/* Max Thumb */}
        <div
          class={`absolute w-2.5 h-3.5 bg-white border border-black/50 rounded-[1px] top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize hover:scale-110 transition-transform ${
            activeThumb() === 'max' ? 'ring-1 ring-[var(--accent-color)]' : ''
          }`}
          style={{ left: `${getPercent(props.valueMax)}%` }}
          onMouseDown={(e) => handleMouseDown('max', e)}
        />
      </div>
    </div>
  );
}
