import { For } from 'solid-js';
import { ChevronRight } from 'lucide-solid';

export interface BreadcrumbItem {
  id: string;
  label: string;
  icon?: any;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onSelect?: (id: string) => void;
  class?: string;
}

export function Breadcrumb(props: BreadcrumbProps) {
  return (
    <nav class={`flex items-center gap-1 text-md font-mono text-[var(--text-muted)] select-none ${props.class || ''}`}>
      <For each={props.items}>
        {(item, index) => {
          const isLast = () => index() === props.items.length - 1;
          const Icon = item.icon;

          return (
            <div class="flex items-center gap-1">
              <button
                type="button"
                onClick={() => props.onSelect?.(item.id)}
                class={`flex items-center gap-1 hover:text-[var(--accent-color)] transition-colors ${
                  isLast() ? 'text-white font-bold' : ''
                }`}
              >
                {Icon && <Icon size={11} />}
                <span>{item.label}</span>
              </button>
              {!isLast() && <ChevronRight size={10} class="opacity-40" />}
            </div>
          );
        }}
      </For>
    </nav>
  );
}
