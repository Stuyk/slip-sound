# Changelog

## v2.0.0

### Changed

- Layout is now DCC based, and standardized across the whole app.
- TailwindCSS is now fully utilized.
- Everything has IDs now.
- Reusable components applied everywhere.

## v1.2.0

### Fixed

- Loud static bursts on seek/loop: audio protocol now serves HTTP Range requests (206 partial content) instead of always returning the whole file.
- Region playback: all play paths (auto-play, double-click, Space) now start inside the selected region.
- Regions ending at the end of the file now loop instead of stopping.
- Region loop point is timer-driven, so playback no longer overshoots the region end (especially when the window is unfocused).
- Region highlight and loop now use the same minimum length (0.03s).
- Space no longer stops working after using the volume slider.
- Moving the volume slider while muted now unmutes.
- Deselecting a sound no longer triggers a bogus audio load.

## v1.1.1

### Added

- Ability to disable auto-categorization in settings.

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
