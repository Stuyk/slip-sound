import { For, JSX, Show, createEffect, createSignal, onCleanup } from 'solid-js';

export interface MenuItem {
  id: string;
  label?: string;
  shortcut?: string;
  icon?: (props: { size?: number }) => JSX.Element;
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
  id?: string;
}

export function ContextMenu(props: ContextMenuProps): JSX.Element {
  let menu: HTMLDivElement | undefined;
  // Opened near the right or bottom edge, the menu flips so it stays on screen.
  const [pos, setPos] = createSignal({ left: 0, top: 0 });

  createEffect(() => {
    if (!props.isOpen) return;
    setPos({ left: props.x, top: props.y });
    requestAnimationFrame(() => {
      if (!menu) return;
      const r = menu.getBoundingClientRect();
      const left = props.x + r.width > window.innerWidth - 4 ? Math.max(4, props.x - r.width) : props.x;
      const top = props.y + r.height > window.innerHeight - 4 ? Math.max(4, props.y - r.height) : props.y;
      setPos({ left, top });
    });
    const onKey = (e: KeyboardEvent): void => {
      // The menu is on top, so it alone handles keys while open.
      e.stopImmediatePropagation();
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey, true);
    onCleanup(() => window.removeEventListener('keydown', onKey, true));
  });

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          props.onClose();
        }}
      >
        <div
          id={props.id}
          ref={menu}
          class="absolute z-50 min-w-60 max-w-80 bg-[#32353a] border border-[#1c1d1f] rounded-[3px] p-1 text-md select-none"
          style={{
            left: `${pos().left}px`,
            top: `${pos().top}px`,
            'box-shadow': '0 10px 25px -5px rgba(0, 0, 0, 0.8)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <For each={props.items}>
            {(item) => {
              if (item.isDivider) {
                return <div class="h-px bg-[#1c1d1f] my-1" />;
              }

              const Icon = item.icon;
              return (
                <button
                  type="button"
                  id={item.id}
                  disabled={item.disabled}
                  onClick={() => {
                    props.onClose();
                    item.onClick?.();
                  }}
                  class={`w-full h-8 flex items-center justify-between gap-3 px-2.5 rounded-[3px] transition-colors cursor-pointer ${
                    item.disabled
                      ? 'opacity-40 pointer-events-none'
                      : item.danger
                        ? 'text-red-300 hover:bg-red-500/20'
                        : 'text-[#f0f3f6] hover:bg-[#007acc] hover:text-white'
                  }`}
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-4 flex items-center justify-center shrink-0">{Icon && <Icon size={13} />}</span>
                    <span class="truncate">{item.label}</span>
                  </div>
                  {item.shortcut && <span class="font-mono opacity-60 shrink-0">{item.shortcut}</span>}
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}
