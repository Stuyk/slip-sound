import { JSX, Show, onMount, onCleanup } from 'solid-js';
import { X } from 'lucide-solid';

export interface ModalProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  title: JSX.Element | string;
  icon?: JSX.Element;
  children: JSX.Element;
  footer?: JSX.Element;
  width?: string;
  maxWidth?: string;
  class?: string;
  bodyClass?: string;
}

export function Modal(props: ModalProps) {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && props.isOpen) {
      e.stopPropagation();
      props.onClose();
    }
  }

  onMount(() => window.addEventListener('keydown', handleKeyDown));
  onCleanup(() => window.removeEventListener('keydown', handleKeyDown));

  return (
    <Show when={props.isOpen}>
      <div
        id={props.id ? `${props.id}-overlay` : undefined}
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-100"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div
          id={props.id || undefined}
          class={`bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[3px] shadow-2xl flex flex-col overflow-hidden max-h-[92vh] ${props.class || ''}`}
          style={{
            width: props.width || '520px',
            'max-width': props.maxWidth || '96vw',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div
            id={props.id ? `${props.id}-header` : undefined}
            class="h-10 min-h-[40px] px-3.5 bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0"
          >
            <div class="flex items-center gap-2 font-bold text-md uppercase tracking-wider text-[var(--text-main)] truncate">
              {props.icon && <span class="text-[var(--accent-color)] flex items-center">{props.icon}</span>}
              <span class="truncate">{props.title}</span>
            </div>
            <button
              id={props.id ? `${props.id}-close-btn` : undefined}
              type="button"
              onClick={props.onClose}
              class="w-7 h-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
              title="Close (Esc)"
            >
              <X size={15} />
            </button>
          </div>

          {/* Modal Content */}
          <div
            id={props.id ? `${props.id}-body` : undefined}
            class={`p-4 overflow-y-auto dcc-scroll text-md text-[var(--text-main)] ${props.bodyClass || ''}`}
          >
            {props.children}
          </div>

          {/* Modal Footer */}
          {props.footer && (
            <div
              id={props.id ? `${props.id}-footer-container` : undefined}
              class="px-3.5 py-2.5 bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center justify-between gap-2 shrink-0"
            >
              {props.footer}
            </div>
          )}
        </div>
      </div>
    </Show>
  );
}
