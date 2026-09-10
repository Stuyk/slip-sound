import { describe, it, expect } from 'vitest'
import { generateExportFilename } from './export'

describe('generateExportFilename', () => {
  it('preserves original stem when naming is original', () => {
    expect(generateExportFilename('kick_drum', 0, 1, 'original', 'sound')).toBe('kick_drum')
  })

  it('generates 2-digit zero-padded numbers for small batches', () => {
    expect(generateExportFilename('ignored', 0, 5, 'numeric', 'snare')).toBe('snare_01')
    expect(generateExportFilename('ignored', 9, 10, 'numeric', 'snare')).toBe('snare_10')
  })

  it('generates 3-digit zero-padded numbers for 100+ batches', () => {
    expect(generateExportFilename('ignored', 0, 150, 'numeric', 'sample')).toBe('sample_001')
    expect(generateExportFilename('ignored', 99, 150, 'numeric', 'sample')).toBe('sample_100')
  })

  it('generates alphabetic sequences', () => {
    expect(generateExportFilename('ignored', 0, 1, 'alpha', 'audio')).toBe('audio_a')
    expect(generateExportFilename('ignored', 25, 26, 'alpha', 'audio')).toBe('audio_z')
    expect(generateExportFilename('ignored', 26, 27, 'alpha', 'audio')).toBe('audio_aa')
  })
})
