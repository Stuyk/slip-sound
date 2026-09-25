import { createSignal, createEffect, For, Show } from 'solid-js';
import type { SoundRow, CategoryFacet } from '../../../preload/index';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Tag, Trash2, CheckCircle2 } from 'lucide-solid';

export default function CategoryModal(props: {
  rows: SoundRow[];
  facets: CategoryFacet[];
  onSave: (category: string, subcategory: string | null) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [category, setCategory] = createSignal('');
  const [subcategory, setSubcategory] = createSignal('');

  const isOpen = (): boolean => props.rows.length > 0;
  const isBulk = (): boolean => props.rows.length > 1;

  createEffect(() => {
    const rows = props.rows;
    if (rows.length === 1) {
      const row = rows[0];
      setCategory(row.category !== 'Uncategorized' ? row.category : '');
      setSubcategory(row.subcategory ?? '');
    } else if (rows.length > 1) {
      setCategory('');
      setSubcategory('');
    }
  });

  const knownCategories = (): string[] => [...new Set(props.facets.map((f) => f.category))].sort();

  const knownSubcategories = (): string[] => {
    const cat = category().trim();
    if (!cat) return [];
    return [
      ...new Set(
        props.facets
          .filter((f) => f.category === cat && f.subcategory)
          .map((f) => f.subcategory as string)
      ),
    ].sort();
  };

  function submit(e: Event): void {
    e.preventDefault();
    const cat = category().trim();
    if (!cat) return;
    props.onSave(cat, subcategory().trim() || null);
  }

  const hasExistingCategory = (): boolean => props.rows.some((r) => r.category !== 'Uncategorized');

  return (
    <Modal
      id="category-modal"
      isOpen={isOpen()}
      onClose={props.onClose}
      title={isBulk() ? `Set Category (${props.rows.length} sounds)` : 'Set Category'}
      icon={<Tag size={15} />}
      width="440px"
      footer={
        <div id="category-modal-footer" class="w-full flex items-center justify-between">
          <Show when={hasExistingCategory()} fallback={<div />}>
            <Button
              id="category-modal-btn-remove"
              variant="ghost"
              size="sm"
              icon={<Trash2 size={12} class="text-red-400" />}
              onClick={props.onRemove}
            >
              <span>{isBulk() ? 'Remove All Categories' : 'Remove Category'}</span>
            </Button>
          </Show>
          <div class="flex items-center gap-2 ml-auto">
            <Button id="category-modal-btn-cancel" variant="ghost" size="sm" onClick={props.onClose}>
              Cancel
            </Button>
            <Button
              id="category-modal-btn-save"
              variant="primary"
              size="sm"
              disabled={!category().trim()}
              icon={<CheckCircle2 size={12} />}
              onClick={submit}
            >
              Save
            </Button>
          </div>
        </div>
      }
    >
      <form id="category-modal-form" onSubmit={submit} class="flex flex-col gap-3">
        <div id="category-modal-target-info" class="text-md text-[var(--text-muted)] truncate pb-1 border-b border-[var(--border-color)]">
          <Show
            when={!isBulk()}
            fallback={<span>Applies to all <strong>{props.rows.length}</strong> selected sounds</span>}
          >
            <span title={props.rows[0]?.path}>Target: <strong>{props.rows[0]?.filename}</strong></span>
          </Show>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-md font-mono uppercase tracking-wider text-[var(--text-muted)]">
            Category
          </label>
          <div class="flex items-center h-7 min-h-[28px] bg-[var(--bg-input)] border border-[var(--border-color)] focus-within:border-[var(--accent-color)] rounded-[2px] px-2">
            <input
              id="category-modal-category-input"
              type="text"
              class="w-full bg-transparent text-md text-[var(--text-main)] focus:outline-none"
              list="category-suggestions"
              value={category()}
              onInput={(e) => setCategory(e.currentTarget.value)}
              placeholder="e.g. Weapons, Foley, UI..."
              autofocus
            />
            <datalist id="category-suggestions">
              <For each={knownCategories()}>{(c) => <option value={c} />}</For>
            </datalist>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-md font-mono uppercase tracking-wider text-[var(--text-muted)]">
            Subcategory <span class="opacity-60 lowercase font-normal">(optional)</span>
          </label>
          <div class="flex items-center h-7 min-h-[28px] bg-[var(--bg-input)] border border-[var(--border-color)] focus-within:border-[var(--accent-color)] rounded-[2px] px-2">
            <input
              id="category-modal-subcategory-input"
              type="text"
              class="w-full bg-transparent text-md text-[var(--text-main)] focus:outline-none"
              list="subcategory-suggestions"
              value={subcategory()}
              onInput={(e) => setSubcategory(e.currentTarget.value)}
              placeholder="e.g. Firearms, Footsteps, Clicks..."
            />
            <datalist id="subcategory-suggestions">
              <For each={knownSubcategories()}>{(s) => <option value={s} />}</For>
            </datalist>
          </div>
        </div>
      </form>
    </Modal>
  );
}
