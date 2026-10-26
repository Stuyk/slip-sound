# Changelog

## v2.1.0

### Added

- Slicer (`Ctrl+K`, the **Slice…** button under the waveform, or File → Slice Sound…): mark any number of regions on one sound and export each one as its own file.
  - Drag on empty space to add a slice; drag its edges to trim or its middle to move it. Slices can overlap.
  - Press `M` while playing to mark a slice's start, then `M` again to mark its end.
  - Auto-Detect splits the sound on silence, with adjustable threshold and minimum gap.
  - Zoom with `Ctrl+Wheel` or `+`/`-`/`0`, pan with the wheel or the overview strip.
  - Each slice gets an editable output name (defaults to `<file>_01`, `<file>_02`, …) and editable start/end times.
  - Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`). Slices are kept for each file until the app closes.
  - Exports go through the regular export dialog, so format, sample rate and bit depth all work as usual.
- Seamless Loop (`Ctrl+L`, the **Loop…** button under the waveform, or File → Make Seamless Loop…): turn a region into a click-free loop.
  - Drag to pick the region (or start from the region selected in the main waveform); drag edges to trim, middle to move.
  - The last part of the region (the tail) is crossfaded over the start (the head). The loop comes out shorter by the crossfade length, and its end runs straight back into its start.
  - Adjustable crossfade length (up to half the region) with Equal Power or Linear curves.
  - Live preview with A/B (`B`) between the seamless loop and the raw region loop; changes are heard immediately.
  - The result view plays the loop twice with the loop point marked, so the seam is visible.
  - Exports through the regular export dialog (any format, sample rate, bit depth).

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
