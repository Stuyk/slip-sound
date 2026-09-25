import { JSX, createSignal, Show } from 'solid-js';
import { ChevronDown, ChevronRight } from 'lucide-solid';

export interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  icon?: any;
  headerAction?: JSX.Element;
  children: JSX.Element;
  class?: string;
}

export function Accordion(props: AccordionProps) {
  const [isOpen, setIsOpen] = createSignal(props.defaultOpen ?? false);

  return (
    <div class={`border border-[var(--border-color)] bg-black/15 rounded-[2px] overflow-hidden ${props.class || ''}`}>
      <div
        class="h-6 px-2 bg-white/5 hover:bg-white/10 flex items-center justify-between cursor-pointer select-none transition-colors"
        onClick={() => setIsOpen(!isOpen())}
      >
        <div class="flex items-center gap-1.5 text-md font-bold text-[var(--text-main)] truncate">
          <span class="text-[var(--text-muted)]">
            {isOpen() ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
          {props.icon && <props.icon size={11} />}
          <span>{props.title}</span>
          {props.badge && (
            <span class="text-md font-mono px-1 py-0.2 rounded bg-white/10 text-[var(--accent-color)]">
              {props.badge}
            </span>
          )}
        </div>

        {props.headerAction && (
          <div onClick={(e) => e.stopPropagation()}>
            {props.headerAction}
          </div>
        )}
      </div>

      <Show when={isOpen()}>
        <div class="p-2.5 border-t border-[var(--border-color)] space-y-2">
          {props.children}
        </div>
      </Show>
    </div>
  );
}
