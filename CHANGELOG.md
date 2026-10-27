# Changelog

## v2.3.0

### Added

- Folders view ([#3](https://github.com/Stuyk/slip-sound/issues/3)): browse your library by its real folder structure. Switch the left sidebar between **Categories** and **Folders**.
  - Expand and collapse folders. Each folder shows how many sounds are in it and everything under it. Expand/collapse all works on the top level, and your expanded folders are remembered for each library.
  - Click a folder to show only the sounds in it and its subfolders. Search, channel, duration and favorite filters all still apply inside it, and so do Select All and Export. Click it again, or the chip next to the search box, to clear it.
  - Filter folders by name; matching folders open up to show where they are.
  - Switching between Categories and Folders clears the other view's filter, so the list is never narrowed by something you can't see.
  - The MCP `search_sounds` tool takes a new `folder` option (absolute, or relative to the library root, e.g. `Foley/Cloth`).
- Right-click a sound for its actions: Play, Effects, Slice, Seamless Loop, Export, Reveal in File Manager, Show in Folders, Copy Path, Favorite, Set Category and Clear Category. With several sounds selected, right-clicking one of them acts on the whole selection.
- Undo and redo for library edits (`Ctrl+Z` / `Ctrl+Shift+Z`, or Edit → Undo/Redo, which name what they'll undo). Covers category changes and favorites, including bulk edits; a toast after each edit has an Undo button.
- Tools connect to each other:
  - **Slicer → Effects:** add effects to every slice at once, then drag or export them with their slice names.
  - **Seamless Loop → Effects:** add effects to the finished loop (fades are skipped so it stays seamless).
  - **Effects → Slicer / Seamless Loop:** "Slice result…" and "Loop result…" open the processed sound in that tool.
- Drag Exports settings in Settings: see the folder, open or change it, and pick the WAV format. The first time you drag out a region or Effects result in a session, a toast says where the copy was saved, with a button to open the folder.

### Changed

- The sidebar is never narrower than 290px, so the Categories/Folders toggle and its buttons always fit. Sidebars saved at a narrower width open at the minimum.
- Search matches each word on its own, in any order: "door squeak" finds `Squeaky_Door_02.wav`. Words inside names joined by `_`, `-` or `.` are now found too ("squeaky" went from 57 to 67 matches in a 178k library), accents are ignored, and folder names are searchable ("rain" finds sounds in a `Rain` folder). Existing libraries update their search index automatically the first time they're opened (about a second for 178k sounds).
- The main waveform loads much faster for long files. It's now read and cached by the app instead of decoding the whole file every time you select a sound, so revisiting a sound is instant. Files that can't be read now say so on the waveform instead of showing nothing.
- Times use one format everywhere (`m:ss.mmm`): the main waveform, region chip, Effects, Slicer, Seamless Loop and the Export dialog.
- The status bar no longer repeats the result count the search box already shows; it shows the library size ("178,825 sounds").
- The right-click menu component was restyled to match the app (32px rows, stays on screen near window edges).

### Fixed

- The CI test step now downloads ffmpeg before running the processing tests.
- Sounds whose file headers report a wrong sample rate (some OGG files) now show their real length on the main waveform.

## v2.2.0

### Added

- Effects ([#3](https://github.com/Stuyk/slip-sound/issues/3)): a tool window for quick fixes before a sound goes into your timeline. Open it with **Effects…** under the waveform, File → Effects…, or `Ctrl+P`. It works on the selected sound, its trimmed region, or a whole multi-selection.
  - Reverse, mono, speed (pitch follows like tape, or keep pitch), pitch shift in semitones that keeps the length, fade in/out with four shapes, and level: change volume, normalize the peak, or normalize loudness (LUFS) with a peak ceiling. Normalizing applies one clean volume change, so dynamics are untouched. A readout shows the sound's loudness and how much the volume will change.
  - Original and With effects waveforms, one above the other. Play either one, click a waveform to play from there, and press `B` to switch between them without losing your place. For a multi-selection, step through the sounds with `←`/`→`.
  - Drag the result straight into your editor, or Export. With several sounds selected, both apply the effects to all of them; the drag is ready once every file is rendered (up to 50 sounds).
  - Presets: nine built-ins (Reverse Swell, Pitch Down Monster, Slow-Mo, Streaming −14 LUFS, Broadcast −23 LUFS, …) in a sidebar, plus save, update, delete, and import/export of your own as JSON.
  - The Export dialog has an **Effects** picker. It's set to None unless you came from the Effects window, so any export (batch, Slicer slices, Seamless Loop) can use a preset. For loops, fades are skipped so the loop stays seamless. The MCP `export_sound` tool takes a new `processing` option.
  - Processed files get a suffix describing the effects, e.g. `door_slam__rev_p-3.wav`. Originals are never changed. The main list and waveform always play and drag the original.
- Drag Exports: dragged-out regions and processed sounds are saved to a persistent folder, `~/Slip Sound/Drag Exports` by default. Editing projects (DaVinci Resolve, Premiere, …) no longer lose them when the OS clears its temp folder. A **Drag Exports** dropdown in the status bar lists recent files and has buttons to open, copy the path, change the folder, set the WAV format, or clear the folder (to the trash).

### Fixed

- Dragging a region out no longer downgrades 24-bit sources to 16-bit. Drag-outs default to 24-bit WAV at the source sample rate.

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
