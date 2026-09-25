import { createSignal, For } from 'solid-js';

export interface ColorStop {
  id: string;
  position: number; // 0 to 1
  color: string;
}

export interface ColorRampProps {
  label?: string;
  stops?: ColorStop[];
  onChange?: (stops: ColorStop[]) => void;
  class?: string;
}

export function ColorRamp(props: ColorRampProps) {
  const [stops] = createSignal<ColorStop[]>(
    props.stops || [
      { id: 'stop-1', position: 0.0, color: '#000000' },
      { id: 'stop-2', position: 0.5, color: '#ff9900' },
      { id: 'stop-3', position: 1.0, color: '#ffffff' },
    ]
  );
  const [selectedId, setSelectedId] = createSignal('stop-2');

  const gradientCss = () => {
    const sorted = [...stops()].sort((a, b) => a.position - b.position);
    const stopStrs = sorted.map((s) => `${s.color} ${(s.position * 100).toFixed(0)}%`);
    return `linear-gradient(90deg, ${stopStrs.join(', ')})`;
  };

  return (
    <div class={`w-full flex flex-col gap-1.5 select-none ${props.class || ''}`}>
      <div class="flex justify-between items-center text-md">
        {props.label && <span class="text-[var(--text-main)]">{props.label}</span>}
        <span class="font-mono text-md text-[var(--text-muted)]">
          {stops().length} Stops
        </span>
      </div>

      {/* Gradient Bar Track */}
      <div
        class="w-full h-5 rounded-[2px] border border-[var(--border-color)] shadow-inner relative"
        style={{ background: gradientCss() }}
      />

      {/* Stop Slider Pins */}
      <div class="w-full h-4 relative -mt-1">
        <For each={stops()}>
          {(stop) => {
            const isSelected = () => selectedId() === stop.id;
            return (
              <div
                class="absolute -translate-x-1/2 top-0 cursor-pointer flex flex-col items-center group"
                style={{ left: `${stop.position * 100}%` }}
                onClick={() => setSelectedId(stop.id)}
              >
                <div
                  class={`w-2.5 h-2.5 border-t border-l border-black rotate-45 ${
                    isSelected() ? 'bg-[var(--accent-color)] scale-125' : 'bg-white'
                  }`}
                />
                <div
                  class="w-2.5 h-2.5 border border-black rounded-[1px] shadow-sm"
                  style={{ "background-color": stop.color }}
                />
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
