import { JSX } from 'solid-js';

export interface SplitPaneProps {
  orientation?: 'horizontal' | 'vertical';
  first: JSX.Element;
  second: JSX.Element;
  initialSplit?: number; // percentage, e.g. 50
  class?: string;
}

export function SplitPane(props: SplitPaneProps) {
  const isHorizontal = props.orientation === 'horizontal';

  return (
    <div class={`flex w-full h-full overflow-hidden ${isHorizontal ? 'flex-row' : 'flex-col'} ${props.class || ''}`}>
      <div class="flex-1 overflow-hidden">
        {props.first}
      </div>

      {/* Resizer Divider Handle */}
      <div
        class={`bg-[var(--border-color)] hover:bg-[var(--accent-color)] transition-colors flex items-center justify-center ${
          isHorizontal ? 'w-1 cursor-col-resize hover:w-1.5' : 'h-1 cursor-row-resize hover:h-1.5'
        }`}
      >
        <div class={`bg-white/40 rounded-full ${isHorizontal ? 'w-0.5 h-4' : 'h-0.5 w-4'}`} />
      </div>

      <div class="flex-1 overflow-hidden">
        {props.second}
      </div>
    </div>
  );
}
