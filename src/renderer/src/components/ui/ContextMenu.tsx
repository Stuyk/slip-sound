import { For, Show } from 'solid-js';

export interface MenuItem {
  id: string;
  label?: string;
  shortcut?: string;
  icon?: any;
  danger?: boolean;
  disabled?: boolean;
  isDivider?: boolean;
  onClick?: () => void;
}

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  onClose: () => void;
  items: MenuItem[];
}

export function ContextMenu(props: ContextMenuProps) {
  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50"
        onClick={props.onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          props.onClose();
        }}
      >
        <div
          class="absolute z-50 w-48 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[2px] shadow-2xl p-1 text-md select-none"
          style={{
            left: `${props.x}px`,
            top: `${props.y}px`,
            "box-shadow": "0 10px 25px -5px rgba(0, 0, 0, 0.8)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <For each={props.items}>
            {(item) => {
              if (item.isDivider) {
                return <div class="h-[1px] bg-[var(--border-color)] my-1" />;
              }

              const Icon = item.icon;
              return (
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick?.();
                    props.onClose();
                  }}
                  class={`w-full flex items-center justify-between px-2 py-1 rounded-[2px] transition-colors ${
                    item.disabled
                      ? 'opacity-40 pointer-events-none'
                      : item.danger
                      ? 'text-red-400 hover:bg-red-500/20'
                      : 'hover:bg-[var(--accent-color)] hover:text-[var(--accent-text)] text-[var(--text-main)]'
                  }`}
                >
                  <div class="flex items-center gap-2">
                    {Icon && <Icon size={12} />}
                    <span>{item.label}</span>
                  </div>
                  {item.shortcut && (
                    <span class="text-md font-mono opacity-60 ml-2">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}
