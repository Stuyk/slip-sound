export interface ProgressBarProps {
  value?: number; // 0 to 100, or undefined for indeterminate
  label?: string;
  statusText?: string;
  class?: string;
}

export function ProgressBar(props: ProgressBarProps) {
  const isIndeterminate = () => props.value === undefined;
  const clamped = () => Math.min(100, Math.max(0, props.value ?? 0));

  return (
    <div class={`w-full flex flex-col gap-1 select-none text-md ${props.class || ''}`}>
      {(props.label || props.statusText || !isIndeterminate()) && (
        <div class="flex justify-between items-center text-md font-mono text-[var(--text-muted)]">
          <span>{props.label || 'Progress'}</span>
          <span>{props.statusText || (!isIndeterminate() ? `${clamped().toFixed(0)}%` : 'Processing...')}</span>
        </div>
      )}

      <div class="h-2 bg-black/40 border border-[var(--border-color)] rounded-[2px] overflow-hidden relative">
        {isIndeterminate() ? (
          <div class="h-full w-1/3 bg-[var(--accent-color)] animate-pulse rounded-[1px] absolute" />
        ) : (
          <div
            class="h-full bg-[var(--accent-color)] transition-all duration-150 rounded-[1px]"
            style={{ width: `${clamped()}%` }}
          />
        )}
      </div>
    </div>
  );
}
