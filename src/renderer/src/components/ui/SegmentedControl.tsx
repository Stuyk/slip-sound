import { For } from 'solid-js';

export interface SegmentItem {
  id: string;
  label: string;
  icon?: any;
}

export interface SegmentedControlProps {
  id?: string;
  items: SegmentItem[];
  value: string;
  onChange: (id: string) => void;
  size?: 'xs' | 'sm';
  class?: string;
}

export function SegmentedControl(props: SegmentedControlProps) {
  return (
    <div
      id={props.id}
      class={`inline-flex items-center h-8 min-h-[32px] bg-[#1e2022] p-0.5 border border-[#1c1d1f] rounded-[3px] gap-0.5 select-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] ${
        props.class || ''
      }`}
    >
      <For each={props.items}>
        {(item) => {
          const isActive = () => props.value === item.id;
          const Icon = item.icon;

          return (
            <button
              id={props.id ? `${props.id}-item-${item.id || 'all'}` : undefined}
              type="button"
              onClick={() => props.onChange(item.id)}
              class={`h-6 min-h-[24px] flex items-center gap-1.5 font-medium transition-all rounded-[2px] px-3 text-md cursor-pointer ${
                isActive()
                  ? 'bg-[#383b40] text-white font-semibold border border-[#1c1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.25)]'
                  : 'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-white/5 border border-transparent'
              }`}
            >
              {Icon && <Icon size={12} />}
              <span>{item.label}</span>
            </button>
          );
        }}
      </For>
    </div>
  );
}
