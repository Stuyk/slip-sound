import { createSignal, For } from 'solid-js';
import { RotateCcw } from 'lucide-solid';

export interface MatrixInputProps {
  label?: string;
  size?: 3 | 4;
  class?: string;
}

export function MatrixInput(props: MatrixInputProps) {
  const size = props.size || 4;

  const identity = () => {
    const arr = Array(size * size).fill(0);
    for (let i = 0; i < size; i++) {
      arr[i * size + i] = 1.0;
    }
    return arr;
  };

  const [matrix, setMatrix] = createSignal<number[]>(identity());

  const resetIdentity = () => setMatrix(identity());

  const updateCell = (index: number, val: number) => {
    setMatrix((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  return (
    <div class={`space-y-1.5 select-none ${props.class || ''}`}>
      <div class="flex items-center justify-between text-md text-[var(--text-muted)] font-mono uppercase">
        <span>{props.label || `Matrix ${size}×${size}`}</span>
        <button
          type="button"
          onClick={resetIdentity}
          class="hover:text-white flex items-center gap-1 transition-colors"
          title="Reset to Identity Matrix"
        >
          <RotateCcw size={9} />
          <span>Identity</span>
        </button>
      </div>

      <div
        class="grid gap-1 p-1.5 bg-black/40 border border-[var(--border-color)] rounded-[2px]"
        style={{
          "grid-template-columns": `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        <For each={matrix()}>
          {(val, idx) => (
            <input
              type="number"
              step="0.01"
              value={val.toFixed(2)}
              onChange={(e) => updateCell(idx(), parseFloat(e.currentTarget.value) || 0)}
              class="w-full h-5 bg-[var(--bg-input)] border border-[var(--border-color)] text-md font-mono text-center text-white focus:outline-none focus:border-[var(--accent-color)] rounded-[1px]"
            />
          )}
        </For>
      </div>
    </div>
  );
}
