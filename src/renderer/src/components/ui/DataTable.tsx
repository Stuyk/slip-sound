import { For, createSignal } from 'solid-js';
import { ArrowUpDown } from 'lucide-solid';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T) => any;
}

export interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  selectedId?: string | number;
  onSelectRow?: (item: T) => void;
  idKey?: keyof T;
  class?: string;
}

export function DataTable<T extends Record<string, any>>(props: DataTableProps<T>) {
  const [sortKey, setSortKey] = createSignal<string | null>(null);
  const [sortAsc, setSortAsc] = createSignal(true);

  const handleHeaderClick = (key: string) => {
    if (sortKey() === key) {
      setSortAsc(!sortAsc());
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedData = () => {
    const key = sortKey();
    if (!key) return props.data;
    return [...props.data].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];
      if (valA < valB) return sortAsc() ? -1 : 1;
      if (valA > valB) return sortAsc() ? 1 : -1;
      return 0;
    });
  };

  return (
    <div class={`w-full border border-[var(--border-color)] bg-[var(--bg-panel)] overflow-x-auto dcc-scroll rounded-[2px] select-none ${props.class || ''}`}>
      <table class="w-full text-md text-left border-collapse">
        <thead class="bg-[var(--bg-panel-header)] text-[var(--text-muted)] font-mono uppercase text-md border-b border-[var(--border-color)]">
          <tr>
            <For each={props.columns}>
              {(col) => (
                <th
                  class={`px-2.5 py-1.5 font-bold cursor-pointer hover:text-white transition-colors ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                  style={{ width: col.width }}
                  onClick={() => handleHeaderClick(String(col.key))}
                >
                  <div class="inline-flex items-center gap-1">
                    <span>{col.header}</span>
                    <ArrowUpDown size={9} class="opacity-40" />
                  </div>
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-color)] font-mono">
          <For each={sortedData()}>
            {(row) => {
              const isSelected = () =>
                props.idKey ? row[props.idKey] === props.selectedId : false;

              return (
                <tr
                  class={`hover:bg-white/5 cursor-pointer transition-colors ${
                    isSelected() ? 'bg-[var(--accent-color)]/20 text-white font-semibold' : 'text-[var(--text-main)]'
                  }`}
                  onClick={() => props.onSelectRow?.(row)}
                >
                  <For each={props.columns}>
                    {(col) => (
                      <td
                        class={`px-2.5 py-1 truncate ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {col.render ? col.render(row) : String(row[col.key as string] ?? '')}
                      </td>
                    )}
                  </For>
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>
    </div>
  );
}
