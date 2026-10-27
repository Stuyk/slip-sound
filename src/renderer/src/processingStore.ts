// Settings for the Effects window, plus the preset list shared with the Export dialog.
// They only apply where the user asks for them (the Effects window, or an Effects
// choice in Export); the main list and waveform always play and drag the raw file.
// Remembered for the session so reopening the window picks up where you left off.
import { createSignal } from 'solid-js'
import {
  DEFAULT_PROCESSING,
  type ProcessingPreset,
  type ProcessingSettings,
  isIdentity,
  matchesPreset,
  normalizeSettings
} from '../../shared/processing'

const [rack, setRackSignal] = createSignal<ProcessingSettings>({ ...DEFAULT_PROCESSING })
const [presets, setPresets] = createSignal<ProcessingPreset[]>([])
const [activePresetId, setActivePresetId] = createSignal<string | null>(null)
const [capabilities, setCapabilities] = createSignal({ rubberband: true, ebur128: true })

export { rack, presets, setPresets, activePresetId, capabilities }

// The settings do something audible.
export const rackActive = (): boolean => !isIdentity(rack())

export function updateRack(patch: Partial<ProcessingSettings>): void {
  setRackSignal(normalizeSettings({ ...rack(), ...patch, enabled: true }))
}

export function resetRack(): void {
  setRackSignal({ ...DEFAULT_PROCESSING })
  setActivePresetId(null)
}

export function applyPreset(p: ProcessingPreset): void {
  setRackSignal(normalizeSettings({ ...p.settings, enabled: true }))
  setActivePresetId(p.id)
}

export const presetSettings = (p: ProcessingPreset): ProcessingSettings =>
  normalizeSettings({ ...p.settings, enabled: true })

export const activePreset = (): ProcessingPreset | undefined =>
  presets().find((p) => p.id === activePresetId())

// The loaded preset has been tweaked since it was applied.
export const presetModified = (): boolean => {
  const p = activePreset()
  return !!p && !matchesPreset(rack(), p)
}

export function clearActivePreset(): void {
  setActivePresetId(null)
}

export async function initProcessing(): Promise<void> {
  try {
    const [list, caps] = await Promise.all([
      window.api.listPresets(),
      window.api.getProcessingCapabilities()
    ])
    setPresets(list)
    setCapabilities(caps)
  } catch {
    // presets/capabilities are optional; effects still work
  }
}
