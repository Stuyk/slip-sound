import { For, Show, createSignal } from 'solid-js';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-solid';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  // Optional button, e.g. "Undo". Toasts with an action stay up a little longer.
  action?: { label: string; onClick: () => void };
}

const [toasts, setToasts] = createSignal<ToastItem[]>([]);

export function showToast(toast: Omit<ToastItem, 'id'>) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  setToasts((prev) => [...prev, { ...toast, id }]);
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, toast.action ? 7000 : 4000);
}

export function ToastContainer() {
  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type?: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={13} class="text-green-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={13} class="text-amber-400 shrink-0" />;
      case 'error':
        return <AlertCircle size={13} class="text-red-400 shrink-0" />;
      case 'info':
      default:
        return <Info size={13} class="text-blue-400 shrink-0" />;
    }
  };

  return (
    <div class="fixed bottom-8 right-8 z-50 flex flex-col gap-2 pointer-events-none select-none">
      <For each={toasts()}>
        {(t) => (
          <div class="pointer-events-auto w-72 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[3px] shadow-2xl p-2.5 flex items-start gap-2 animate-in slide-in-from-bottom-2 duration-150">
            {getIcon(t.type)}
            <div class="flex-1 text-md">
              <div class="font-bold text-[var(--text-main)] leading-tight">{t.title}</div>
              <Show when={t.message}>
                <div class="text-md text-[var(--text-muted)] mt-0.5">{t.message}</div>
              </Show>
            </div>
            <Show when={t.action}>
              {(a) => (
                <button
                  type="button"
                  onClick={() => {
                    a().onClick();
                    dismiss(t.id);
                  }}
                  class="h-6 px-2 rounded-[3px] border border-[var(--border-color)] text-md font-medium text-[var(--accent-color)] hover:bg-white/10 shrink-0"
                >
                  {a().label}
                </button>
              )}
            </Show>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              class="text-[var(--text-muted)] hover:text-white"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
