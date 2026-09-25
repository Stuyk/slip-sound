import { JSX, createSignal, Show } from 'solid-js';
import { ChevronDown, ChevronRight } from 'lucide-solid';

export interface WorkstationPanelProps {
  title: string;
  actions?: JSX.Element;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: JSX.Element;
  class?: string;
  bodyClass?: string;
}

export function WorkstationPanel(props: WorkstationPanelProps) {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded ?? true);

  return (
    <div class={`flex flex-col bg-[var(--bg-panel)] overflow-hidden border-[var(--border-color)] ${props.class || ''}`}>
      {/* Panel Header */}
      <div
        class="h-7 px-2.5 bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center justify-between select-none cursor-pointer shrink-0"
        onClick={() => props.collapsible && setExpanded(!expanded())}
      >
        <div class="flex items-center gap-1.5 font-bold text-md uppercase tracking-wider text-[var(--text-main)] truncate">
          {props.collapsible && (
            <span class="text-[var(--text-muted)]">
              {expanded() ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
          )}
          <span>{props.title}</span>
        </div>

        {props.actions && (
          <div class="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {props.actions}
          </div>
        )}
      </div>

      {/* Panel Body */}
      <Show when={expanded()}>
        <div class={`flex-1 overflow-y-auto dcc-scroll ${props.bodyClass || 'p-3'}`}>
          {props.children}
        </div>
      </Show>
    </div>
  );
}
