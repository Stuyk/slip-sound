# Changelog

## v1.1.0

### Added
- Global Ctrl/Cmd+A shortcut: `selectAllFiltered()` selects every sound matching active filters, not just visible/loaded rows.
- Transactional bulk category APIs (`setCategories`, `clearCategories`) in `src/main/db.ts`, wired through IPC (`src/main/index.ts`) and preload (`src/preload/index.ts`) for efficient large-selection edits.
- Ctrl/Cmd+A shortcut documented in README and in-app HelpModal.
- Unit tests for select-all and filtered selection behavior.

### Changed
- Multi-selection storage switched from index-based `Set<number>` to path-keyed `Map<string, SoundRow>`, so selection, drag, export, and category operations work correctly across infinite scroll, including unloaded items.
- Select-all guarded by a `selectAllSeq` counter to avoid race conditions from rapid/concurrent triggers.
- CI/CD: pull requests now only run a simple check (install, tests, build) instead of full packaging.
- CI/CD: main-branch build/release now stops immediately if `package.json` version has already been released, skipping build entirely.
- CI/CD: added macOS build/release (`--mac`), producing `.dmg`/`.zip` artifacts alongside Linux and Windows.
- Multi-select toolbar switched to icon buttons with tooltips (Export, Set Category, Clear Category, Clear selection), and added a Clear Category action for the current selection.
- Multi-select toolbar icons enlarged (14px → 18px) for readability, and Tag icons swapped for clearer filled designs.
