# Spec: Sound processing before export and drag-out

Status: **Implemented in v2.2.0**, Phases 1–3 plus presets and LUFS (decisions in §11). The UI was later reworked into an Effects window (§12), which replaces the inline rack, bypass and sticky-processing parts of §6. Phase 4 items not covered by those remain open.
Source: [Issue #3](https://github.com/Stuyk/slip-sound/issues/3) (aarondessaint), plus maintainer requirement: processing must apply to whatever is being exported — whole file, trimmed region, multi-selection, Slicer slices, Seamless Loop output.

---

## 1. Problem

A video editor (DaVinci Resolve) wants to replace Soundly with Slip Sound. The missing piece is quick, non-destructive processing between "found the sound" and "dropped it on the timeline":

1. Reverse
2. Pitch shift in semitones, keeping duration
3. Speed / varispeed
4. Gain and normalize
5. Fade in / fade out
6. Sum to mono

These should apply to **preview, region export, and drag-out**.

Second problem, confirmed in code: drag-out renders go to a fresh `os.tmpdir()/slip-sound-XXXX/` folder (`sounds:export-temp` in `src/main/index.ts`). NLEs reference media by path, so when the OS clears temp the clips go **offline** in the Resolve project. Those renders are also always **16-bit** (the `exportRegion` default), which silently downgrades 24-bit sources.

## 2. Goals

- One processing chain, defined once, applied identically everywhere audio leaves the app: preview, Export dialog, drag-out (single, region, multi-select), Slicer export, Seamless Loop export, MCP `export_sound`.
- What you hear in preview is bit-for-bit the file you get. No separate "approximate" preview engine.
- Source files are never modified.
- Drag-out files live in a persistent, user-configurable folder, at full quality.
- Zero cost when processing is off: no extra ffmpeg pass, and row drag still hands over the original file.

## 3. Non-goals (v1)

- Real-time effects while scrubbing (we render, then play).
- EQ, reverb, noise reduction, time-stretch curves, per-file saved processing, presets.
- Processing inside the Slicer / Seamless Loop **preview** (their exports are processed; their in-tool playback stays raw in v1, see Phase 4).

## 4. The processing chain

### 4.1 Settings model

```ts
// src/shared/processing.ts  (new; shared by main + renderer)
export interface ProcessingSettings {
  enabled: boolean            // master bypass; false = identity
  reverse: boolean
  speed: number               // 0.25–4.0, 1 = off
  speedMode: 'varispeed' | 'stretch'  // varispeed: pitch follows speed (tape); stretch: keep pitch
  pitch: number               // semitones, -24..+24, 0 = off (duration preserved)
  mono: boolean
  fadeIn: number              // seconds, 0 = off
  fadeOut: number             // seconds, 0 = off
  fadeCurve: 'linear' | 'exp' | 'log' | 'scurve'
  gainMode: 'gain' | 'peak' | 'lufs'
  gainDb: number              // gain mode: -24..+24 dB
  peakDb: number              // peak mode: target sample peak, -24..0 dBFS (default -1)
  lufs: number                // lufs mode: integrated loudness target, -36..-8 LUFS (default -16)
  truePeakDb: number          // lufs mode: true-peak ceiling, -9..0 dBTP (default -1)
}
```

`isIdentity(s)` returns true when `enabled` is false or every effect is at its neutral value. Identity means no processing at all: same file, same code path as today.

### 4.2 Fixed order

Order matters (for example a fade-in must land at the *audible* start after reversing), so it is fixed and not user-reorderable:

| # | Stage | ffmpeg | Notes |
|---|-------|--------|-------|
| 0 | Trim | input `-ss`/`-to` (as today) | Region, slice, or whole file |
| 1 | Reverse | `areverse` | Buffers the whole clip in memory (see §9) |
| 2 | Mono | `pan=mono\|c0=1/n*c0+…` | Equal-weight average of all channels; never clips |
| 3 | Speed | varispeed: `asetrate=sr*k,aresample=sr` · stretch: `rubberband=tempo=k` (fallback `atempo` chain) | Changes output duration to `len / k` |
| 4 | Pitch | `rubberband=pitch=2^(st/12):pitchq=quality` (fallback `asetrate,aresample,atempo`) | Duration preserved |
| 5 | Fades | `afade=t=in:d=…:curve=…`, `afade=t=out:st=outDur-d:d=…` | Clamped to half the output duration each |
| 6 | Gain / Normalize | `volume=XdB` | Normalize = measure pass + volume (§4.4) |
| 7 | Output | `aresample`, codec, bit depth | From Export dialog or drag-format pref |

Mono runs before speed and pitch so `rubberband` processes one channel instead of N.

### 4.3 Filter builder (pure, unit-tested)

```ts
buildFilterChain(
  s: ProcessingSettings,
  ctx: { start: number; end: number; sampleRate: number; channels: number; hasRubberband: boolean }
): { filters: string[]; outputDuration: number; summary: string[] }
```

- Returns `[]` for identity, which keeps today's ffmpeg args exactly.
- `outputDuration = (end - start) / speed`; fade-out `st` is computed from it (afade has no "from end" mode).
- `summary` gives short tags for UI and filenames: `['rev', 'x0.5', 'p-3', 'mono', 'fi50', 'fo200', 'norm-1']`.
- `atempo` only accepts 0.5–2.0 per instance, so the fallback chains instances (e.g. 0.25 = `atempo=0.5,atempo=0.5`).

### 4.4 Normalize (two-pass, static gain)

Both modes apply one **static** gain: no compression or limiting, so transients and dynamics stay intact, which is what you want for sound effects.

1. **Measure:** run the chain through stage 5 into `ebur128=peak=sample+true` with `-f null -`. Parse the integrated loudness (LUFS), sample peak and true peak.
2. **Peak mode:** gain = `peakDb − samplePeak`.
3. **LUFS mode:** gain = `lufs − integrated`, then capped so `truePeak + gain ≤ truePeakDb`. When the cap kicks in, the UI says "limited by true-peak ceiling".
4. Apply `volume=<gain>dB` in the real render.

Edge cases:
- Silent input (peak `-inf`) gets no gain.
- Clips too short or quiet for gated loudness (integrated reads −70) fall back to peak mode, and the UI says so.
- Measurements are cached by the render key minus the gain settings, so changing the target doesn't re-measure.

### 4.5 Loudness readout

The Process panel shows the processed sound's measured **LUFS / sample peak / true peak** and the gain normalize will apply ("−31.2 LUFS · pk −6.0 · tp −5.7 → +15.2 dB"). It comes from the same measure pass and updates as you browse.

### 4.6 Capability detection

The Linux binary bundled by `ffmpeg-static` (`b6.1.1`, johnvansickle build) includes `rubberband`. **We have not verified the Windows and macOS binaries.** At startup main runs `ffmpeg -hide_banner -filters` once and caches `hasRubberband`.

- With rubberband: high-quality pitch and stretch.
- Without it: fallback chains, and the Process panel shows "Pitch: basic quality on this platform".

## 5. Where processing applies

The single principle: **the Process panel is the current processing rack. Anything you export or drag while it's enabled goes through it.** A visible badge everywhere makes that state obvious.

| Target | Today | With processing |
|--------|-------|-----------------|
| **Preview** (waveform dock, whole file or region) | `<audio>` plays the source; the region loops via timer | Plays the rendered result of the region (or whole file); loops the whole render |
| **Region drag-out** (grip handle) | 16-bit temp render on region change | Processed render into the drag folder, re-rendered when region *or* processing changes |
| **Row drag** (single) | Original file | Original if identity; otherwise the processed render (the same file as the preview, cached) |
| **Row drag** (multi-select) | Original files | Originals if identity; otherwise each file is pre-rendered in the background once the selection settles (see §7.3) |
| **Export dialog** (file / region / batch) | ffmpeg trim + format | Same, plus the chain. The dialog shows the chain summary and an "Apply processing" checkbox (default = rack enabled) |
| **Slicer export** | One trimmed export per slice | Each slice processed independently (fades and normalize apply per slice) |
| **Seamless Loop export** | Renders loop WAV → export | Chain applied to the loop render. **Fades are skipped** (they would break the seamless join); the dialog says so |
| **MCP `export_sound`** | Trim + format | Optional `processing` object (same schema, zod-validated) |

This covers "modify the trimmed version" (region + chain), "multi-select" (batch export and multi drag), and "whatever" (slices, loops, MCP) with one code path.

## 6. UX

### 6.1 Process panel

A collapsible strip between the waveform canvas and the footer toolbar. It's toggled by a new **Process** button in the footer, next to Slice…/Loop…, or `Ctrl+P`. It stays collapsed until first used.

```
[⏻ Process]  Reverse [ ]  Speed [1.00x ▾ Varispeed|Stretch]  Pitch [ 0 st]  Mono [ ]
             Fade in [  0 ms]  Fade out [  0 ms]  Curve [Linear▾]  Gain [0.0 dB | Normalize -1 dBFS]  [Reset]
```

- Number fields use the existing `NumberInput`: drag to scrub (Shift = fine), double-click to type a value. **Reset** returns everything to neutral.
- Every non-neutral control is highlighted, so the active effects are visible at a glance.
- When the rack is enabled and non-identity, a **"Processed: rev · p-3 · fo200"** chip appears in the waveform header, the status bar, and the Export dialog title. Clicking the chip toggles bypass.
- **Presets** dropdown at the left of the strip (see §6.5).
- `B` = bypass / A-B while previewing (same key as the Seamless Loop tool). Bypass means "hear the source"; it does not change what's enabled for export.

### 6.2 Waveform overlay

The canvas keeps showing the **source** (trimming happens on the source, before processing). It adds:

- fade-in and fade-out ramps drawn inside the region (or the whole file)
- a ⟲ marker when reversed
- the playhead **mapped** from output time back to source time: `src = reverse ? end - t·k : start + t·k`, where `k` = speed. Pitch doesn't change timing, so the mapping stays exact.

### 6.3 Render state

- Renders are debounced (150 ms) on any change of region, processing, or selection.
- While a new render is in flight, the old one keeps playing. The Play button and drag grip show a spinner, and the drag grip is disabled until the render exists (Electron `startDrag` needs a real file at drag time).
- Errors (e.g. the drag folder is unwritable) appear in a toast with "Open Settings".

### 6.4 Rack lifetime

The rack is **sticky across sounds for the session** (audition 40 whooshes pitched down, Soundly-style). It is not persisted across restarts and opens reset; presets are how you get a chain back.

### 6.5 Presets

- **Dropdown:** built-in presets (read-only) above your own, separated by a divider.
- **Save as…:** names the current chain. **Update** overwrites the selected user preset. **Rename** and **Delete** too.
- Changing any control after loading a preset marks it modified (`Pitch Down •`); re-selecting the preset reverts.
- A preset stores every field except `enabled`. Loading a preset turns the rack on.
- **Storage:** `userData/processing-presets.json`, via IPC, schema-versioned. Not `localStorage`, so presets survive cache clears.
- **Export / Import** buttons (a JSON file) for sharing a team's preset set.
- **Built-ins:** Reverse Swell (reverse + 40 ms fade-out); Pitch Down Monster (−7 st, peak −1); Chipmunk (+7 st); Slow-Mo (varispeed 0.5x); Speed Up (varispeed 1.5x); Dialog Mono (mono, peak −1); Streaming Loudness (−14 LUFS, −1 dBTP); Broadcast Loudness (−23 LUFS, −1 dBTP); Clean Edges (5 ms fades).

### 6.6 Drag Exports dropdown

The drag-out folder is visible per user: `~/Slip Sound/Drag Exports` (`%USERPROFILE%\Slip Sound\Drag Exports` on Windows). A **Drag Exports ▾** button in the status bar (also File → Drag Exports…) opens a dropdown with:

- the 15 most recent drag files: name, size, time ago. Click to reveal one in the file manager.
- **Open folder**, **Copy path**, **Change folder…**, **Reset to default**
- **Format:** WAV 16 / **24 (default)** / 32-bit float, at the source sample rate. This fixes today's 16-bit downgrade.
- folder size, and **Clear…** (confirms with file count and size). Never automatic, because NLE projects reference these files.

Only files you actually drag land in the folder. Renders are staged in the app cache and copied into the drag folder at drag start, so auditioning 200 sounds doesn't leave 200 files behind.

## 7. Architecture

### 7.1 New and changed modules

| Module | Change |
|--------|--------|
| `src/shared/processing.ts` (new) | Settings type, defaults, `isIdentity`, `buildFilterChain`, `summary`, `mapOutputToSourceTime`, `renderKey`. Add `src/shared/**` to both `tsconfig.node.json` and `tsconfig.web.json` |
| `src/main/export.ts` | `ExportParams.processing?` → `-af` chain; `measurePeak()`; capability probe |
| `src/main/renders.ts` (new) | `renderProcessed({source, start, end, processing, purpose})` with deterministic paths, in-flight dedupe by key, and cancellation (kills the superseded ffmpeg for previews) |
| `src/main/prefs.ts` | `dragExportFolder`, `dragFormat` |
| `src/main/index.ts` | IPC: `process:capabilities`, `process:render-preview`, `process:render-drag` (single/multi), `drag:folder-info`, `drag:clear-folder`, settings get/set; `sounds:export-batch` passes `processing` through; `sounds:export-temp` is replaced by `process:render-drag` |
| `src/main/mcp/server.ts` | `export_sound` accepts an optional `processing` |
| `src/preload/index.ts` | Matching API and types |
| `src/renderer/src/components/ProcessPanel.tsx` (new) | The strip UI |
| `WaveformPreview.tsx` | Plays the processed preview when non-identity; draws the overlay; maps the playhead; drag grip uses `render-drag` |
| `App.tsx` | Owns the rack signal; feeds `WaveformPreview`, `ExportModal`, row drag, Slicer/Loop exports; `Ctrl+P` |
| `ExportModal.tsx` | Chain summary, "Apply processing" checkbox, loop note about fades |

### 7.2 Render cache and naming

- **Key:** `sha1(sourcePath, mtimeMs, size, start, end, normalized settings, format)`. Identical requests reuse the same file, so re-dragging never duplicates.
- **One render serves preview and drag:** `userData/cache/renders/<key>.wav`, written in the drag format (24-bit by default, source rate). The preview plays it; drag start copies it into the drag folder under its readable name. LRU-trimmed to 2 GB on startup.
- **Suffixes:** processed files get the summary suffix both in drag-out *and* in Export (`door_slam__rev_p-3.wav`); drag files also carry a short key for uniqueness.
- **Drag file name:** `<stem>[_<start>-<end>]__<summary>_<key6>.<ext>`, e.g. `door_slam_1.20-2.85__rev_p-3_7f3a2c.wav`. It's readable in an NLE bin, and stable, so Resolve relinks cleanly.
- **Writes are atomic:** render to `.<name>.partial`, then rename. A half-written file is never handed to a drag.

### 7.3 Multi-select drag

`startDrag` needs every file present synchronously, so when the rack is non-identity:

- On selection change (debounced 400 ms) main pre-renders all selected files into the drag folder, with concurrency = CPU count − 1. The selection toolbar shows "Preparing 12/40…".
- Dragging before that finishes is **blocked** with a toast ("Still processing 12/40…"). Drag works once every file is ready.
- Above **50** files, background pre-rendering is skipped. The drag handle tooltip says "Too many to process for drag, use Export" (Ctrl+E still works and shows progress).

## 8. Testing

**Unit (vitest, `src/shared/processing.test.ts`):**
- identity → `[]` filters
- order of stages
- fade clamping
- fade-out `st` with speed ≠ 1
- `atempo` chaining for 0.25x / 4x
- mono coefficients for 1, 2 and 6 channels
- summary tags and stable keys (key changes on every field, region change and mtime change)
- `mapOutputToSourceTime` with reverse × speed

**Integration (vitest, real ffmpeg on generated signals, like `export.test.ts`):**
- reverse: the output equals the time-reversed input (ramp signal)
- speed 2x varispeed → half duration; stretch 2x → half duration with the same dominant frequency (FFT peak ±2%)
- pitch +12 → frequency doubles, duration ±1%
- mono → one channel, no clipping on full-scale correlated stereo
- fades → first and last samples ≈ 0, mid-region untouched
- normalize → peak within ±0.1 dB of target; silence stays silent
- 24-bit source → 24-bit drag file

**End-to-end (Electron driver, as used for the Slicer/Loop work):**
- panel → preview renders → playhead mapping when reversed
- region drag file lands in the drag folder and survives an app restart
- batch export applies the chain to every file
- Slicer and Loop exports honor the checkbox; Loop export skips fades

## 9. Risks and edge cases

| Risk | Mitigation |
|------|------------|
| `areverse` holds the whole clip in RAM (a 1-hour 96k stereo file is about 2.7 GB as float) | Above 10 minutes of output, Reverse shows a warning and asks for confirmation |
| Rubberband is slow on long files, so preview lags | Debounce, keep playing the old render, spinner; previews render the region only. Measure on a 5-minute file during Phase 2 |
| Rubberband missing on Windows/macOS builds | Capability probe plus fallback chains; verify on CI runners in Phase 1 |
| The drag folder is on an unplugged drive | Fall back to the default folder for this session, with a toast |
| Stereo-to-mono phase cancellation | Documented; equal-weight average (users can choose L or R later if requested) |
| Fades longer than the clip | Each fade is clamped to half the output duration |
| Normalize on a reversed or faded chain | The measure pass runs on the exact chain minus gain, so the target holds |
| Speed changes output length but the Export dialog shows source length | The dialog shows output duration once the chain is non-identity |

## 10. Phasing

1. **Engine and drag folder.** Shared settings and builder with tests; export integration plus normalize; capability probe; persistent drag folder; 24-bit drag default. This alone fixes the "offline in Resolve" bug.
2. **Process panel and preview.** Panel UI; preview renders; waveform overlay and playhead mapping; single and region drag with processing; bypass (`B`).
3. **Everywhere else.** Export dialog checkbox and summary for batches; multi-select drag pre-render; Slicer and Loop export integration; MCP `processing` param; README, site and screenshots.
4. **Later.** Processing in the Slicer/Loop preview; LUFS normalize; presets ("Whoosh down", "Reverse swell"); per-sound remembered processing.

## 11. Decisions

1. **Rack lifetime:** sticky across sounds for the session, not persisted. Presets cover reuse (§6.4–6.5).
2. **Drag folder:** per-user `~/Slip Sound/Drag Exports`, discoverable through the Drag Exports dropdown (§6.6).
3. **Suffixes:** yes, for both Export and drag-out.
4. **Normalize:** peak and LUFS (static gain, true-peak ceiling), plus a live loudness readout (§4.4–4.5).
5. **Multi-select drag:** blocked until every file is processed (§7.3).
6. **Contribution:** built in-house to close out the issue. Git operations are the maintainer's.

## 12. UI revision: Effects window

The first build put an always-on processing rack under the main waveform. In use it was confusing:

- There were three different "on" signals: a header chip, a panel switch, and a footer button that only toggled the panel.
- Hidden state that stayed on while browsing quietly changed every export and drag.
- One flat row of jargon-labelled controls.
- Nothing to compare the source and result side by side.

What replaced it:

- **Effects window** (`Ctrl+P`, **Effects…**, File → Effects…), built like the Slicer and Seamless Loop tools:
  - Presets sidebar.
  - *Original* and *With effects* waveforms, with `B` for A/B and click to play from a point.
  - Four control cards (Basics, Speed & Pitch, Fades, Level) with sliders and typeable values.
  - Drag and Export in the footer.
  - Works on one sound, its region, or a multi-selection (preview steps through with ←/→).
- **The main list and waveform always play and drag the original.** There is no global bypass, and the main view never pre-renders anything for drags.
- **Export dialog Effects picker:**
  - Defaults to None.
  - Pre-selects "From the Effects window" when opened from there.
  - Any preset can be applied to batches, Slicer slices and loops.
- **Settings are remembered for the session** inside the Effects window only.
