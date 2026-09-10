import { createSignal, createEffect, For, Show } from 'solid-js'
import type { SoundRow, CategoryFacet } from '../../../preload/index'
import { TagIcon, XIcon, Trash2Icon, CheckCircleIcon } from './icons'

export default function CategoryModal(props: {
  rows: SoundRow[]
  facets: CategoryFacet[]
  onSave: (category: string, subcategory: string | null) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [category, setCategory] = createSignal('')
  const [subcategory, setSubcategory] = createSignal('')

  const isOpen = (): boolean => props.rows.length > 0
  const isBulk = (): boolean => props.rows.length > 1

  createEffect(() => {
    const rows = props.rows
    // Prefill from the single row being edited. For a bulk edit, categories
    // likely differ across the selection, so leave the fields blank rather
    // than showing a misleading single value.
    if (rows.length === 1) {
      const row = rows[0]
      setCategory(row.category !== 'Uncategorized' ? row.category : '')
      setSubcategory(row.subcategory ?? '')
    } else if (rows.length > 1) {
      setCategory('')
      setSubcategory('')
    }
  })

  const knownCategories = (): string[] => [...new Set(props.facets.map((f) => f.category))].sort()

  const knownSubcategories = (): string[] => {
    const cat = category().trim()
    if (!cat) return []
    return [...new Set(props.facets.filter((f) => f.category === cat && f.subcategory).map((f) => f.subcategory as string))].sort()
  }

  function submit(e: Event): void {
    e.preventDefault()
    const cat = category().trim()
    if (!cat) return
    props.onSave(cat, subcategory().trim() || null)
  }

  const hasExistingCategory = (): boolean => props.rows.some((r) => r.category !== 'Uncategorized')

  return (
    <Show when={isOpen()}>
      <div class="modal-backdrop" onClick={props.onClose}>
        <div class="modal-dialog category-modal-dialog" onClick={(e) => e.stopPropagation()}>
          <header class="modal-header">
            <div class="modal-title-wrap">
              <TagIcon size={16} class="text-blue-400" />
              <h2 class="modal-title">{isBulk() ? `Set Category (${props.rows.length} sounds)` : 'Set Category'}</h2>
            </div>
            <button class="modal-close-btn" onClick={props.onClose} title="Close">
              <XIcon size={15} />
            </button>
          </header>

          <form onSubmit={submit}>
            <div class="category-modal-body">
              <div class="export-field-row" style={{ 'margin-bottom': '4px' }}>
                <Show
                  when={!isBulk()}
                  fallback={
                    <span class="category-modal-filename">
                      Applies to all {props.rows.length} selected sounds
                    </span>
                  }
                >
                  <span class="category-modal-filename" title={props.rows[0]?.path}>
                    {props.rows[0]?.filename}
                  </span>
                </Show>
              </div>

              <div class="export-form-row">
                <label class="export-form-label">Category</label>
                <div class="export-form-control">
                  <input
                    type="text"
                    class="export-text-input"
                    list="category-suggestions"
                    value={category()}
                    onInput={(e) => setCategory(e.currentTarget.value)}
                    placeholder="e.g. Weapons"
                    autofocus
                  />
                  <datalist id="category-suggestions">
                    <For each={knownCategories()}>{(c) => <option value={c} />}</For>
                  </datalist>
                </div>
              </div>

              <div class="export-form-row">
                <label class="export-form-label">Subcategory</label>
                <div class="export-form-control">
                  <input
                    type="text"
                    class="export-text-input"
                    list="subcategory-suggestions"
                    value={subcategory()}
                    onInput={(e) => setSubcategory(e.currentTarget.value)}
                    placeholder="Optional, e.g. Firearms"
                  />
                  <datalist id="subcategory-suggestions">
                    <For each={knownSubcategories()}>{(s) => <option value={s} />}</For>
                  </datalist>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <Show when={hasExistingCategory()} fallback={<span />}>
                <button type="button" class="btn-flat btn-ghost category-remove-btn" onClick={props.onRemove}>
                  <Trash2Icon size={13} />
                  <span>{isBulk() ? 'Remove All Categories' : 'Remove Category'}</span>
                </button>
              </Show>
              <div class="export-footer-actions">
                <button type="button" class="btn-flat btn-ghost" onClick={props.onClose}>
                  Cancel
                </button>
                <button type="submit" class="btn-flat btn-primary" disabled={!category().trim()}>
                  <CheckCircleIcon size={14} />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Show>
  )
}
