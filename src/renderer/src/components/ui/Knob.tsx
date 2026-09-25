import { createSignal, onCleanup } from 'solid-js';

export interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  unit?: string;
  onChange?: (val: number) => void;
  class?: string;
}

export function Knob(rawProps: KnobProps) {
  const min = rawProps.min ?? 0;
  const max = rawProps.max ?? 100;
  const step = rawProps.step ?? 1;
  const [isDragging, setIsDragging] = createSignal(false);

  let startY = 0;
  let startVal = 0;

  const sizePx = {
    sm: 32,
    md: 44,
    lg: 56,
  }[rawProps.size || 'md'];

  // Normalized 0 to 1
  const normalized = () => Math.max(0, Math.min(1, (rawProps.value - min) / (max - min)));

  // Angles: -135 deg to +135 deg (270 degree sweep)
  const angle = () => -135 + normalized() * 270;

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    startY = e.clientY;
    startVal = rawProps.value;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY; // drag up to increase
      const multiplier = moveEvent.shiftKey ? 0.1 : 1;
      const range = max - min;
      const change = (deltaY / 150) * range * multiplier;
      let next = startVal + change;
      next = Math.max(min, Math.min(max, next));
      const stepped = Math.round(next / step) * step;
      rawProps.onChange?.(Number(stepped.toFixed(2)));
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
    <div class={`flex flex-col items-center gap-1 select-none ${rawProps.class || ''}`}>
      {/* Knob Dial */}
      <div
        class={`relative rounded-full border border-[var(--border-color)] bg-[var(--bg-input)] cursor-ns-resize shadow-inner transition-colors flex items-center justify-center ${
          isDragging() ? 'ring-1 ring-[var(--accent-color)] border-[var(--accent-color)]' : 'hover:border-white/40'
        }`}
        style={{
          width: `${sizePx}px`,
          height: `${sizePx}px`,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Outer Arc Track */}
        <svg class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1">
          <circle
            cx="50%"
            cy="50%"
            r="40%"
            stroke="rgba(255,255,255,0.1)"
            stroke-width="3"
            fill="none"
            stroke-dasharray="140"
            stroke-dashoffset="35"
          />
          <circle
            cx="50%"
            cy="50%"
            r="40%"
            stroke="var(--accent-color)"
            stroke-width="3"
            fill="none"
            stroke-dasharray="140"
            stroke-dashoffset={140 - normalized() * 105}
            stroke-linecap="round"
          />
        </svg>

        {/* Needle Indicator */}
        <div
          class="w-full h-full relative pointer-events-none flex items-center justify-center"
          style={{ transform: `rotate(${angle()}deg)` }}
        >
          <div class="w-1 h-3 bg-white rounded-full -translate-y-2 shadow-sm" />
        </div>
      </div>

      {/* Label & Value */}
      <div class="text-center">
        {rawProps.label && (
          <span class="text-md font-bold uppercase text-[var(--text-muted)] block truncate">
            {rawProps.label}
          </span>
        )}
        <span class="text-md font-mono font-semibold text-[var(--accent-color)]">
          {rawProps.value.toFixed(1)}
          {rawProps.unit && <span class="text-md text-[var(--text-muted)] ml-0.5">{rawProps.unit}</span>}
        </span>
      </div>
    </div>
  );
}
