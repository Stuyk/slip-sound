import { For } from 'solid-js';

export interface TabItem {
  id: string;
  label: string;
  icon?: any;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill' | 'workstation';
  class?: string;
}

export function Tabs(props: TabsProps) {
  const variant = props.variant || 'workstation';

  return (
    <div class={`flex items-center gap-1 select-none overflow-x-auto dcc-scroll ${props.class || ''}`}>
      <For each={props.items}>
        {(tab) => {
          const isActive = () => props.activeId === tab.id;

          if (variant === 'underline') {
            return (
              <button
                type="button"
                onClick={() => props.onChange(tab.id)}
                class={`h-7 px-3 text-md font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isActive()
                    ? 'border-[var(--accent-color)] text-[var(--accent-color)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {tab.icon && <tab.icon size={13} />}
                <span>{tab.label}</span>
              </button>
            );
          }

          if (variant === 'pill') {
            return (
              <button
                type="button"
                onClick={() => props.onChange(tab.id)}
                class={`px-2.5 py-1 text-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap rounded ${
                  isActive()
                    ? 'bg-[var(--accent-color)] text-[var(--accent-text)]'
                    : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]'
                }`}
              >
                {tab.icon && <tab.icon size={12} />}
                <span>{tab.label}</span>
              </button>
            );
          }

          // 'workstation' variant (standard DCC shelf tab)
          return (
            <button
              type="button"
              onClick={() => props.onChange(tab.id)}
              class={`h-6 px-2.5 text-md uppercase font-bold tracking-wider transition-colors flex items-center gap-1 whitespace-nowrap border-t border-x ${
                isActive()
                  ? 'bg-[var(--bg-panel)] text-[var(--text-main)] border-[var(--border-color)] border-b-transparent shadow-sm'
                  : 'bg-black/20 text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-white/5'
              }`}
              style={{
                "border-top-left-radius": "var(--ui-radius)",
                "border-top-right-radius": "var(--ui-radius)",
              }}
            >
              {tab.icon && <tab.icon size={11} />}
              <span>{tab.label}</span>
            </button>
          );
        }}
      </For>
    </div>
  );
}
