import { describe, it, expect } from 'vitest'
import { generateExportFilename, sanitizeStem } from './export'

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

describe('sanitizeStem', () => {
  it('returns null for empty or unusable names', () => {
    expect(sanitizeStem(undefined)).toBeNull()
    expect(sanitizeStem('')).toBeNull()
    expect(sanitizeStem('   ')).toBeNull()
    expect(sanitizeStem('...')).toBeNull()
  })

  it('strips path separators so a name cannot escape the export folder', () => {
    expect(sanitizeStem('../../etc/passwd')).toBe('_.._etc_passwd')
    expect(sanitizeStem('a\\b')).toBe('a_b')
  })

  it('replaces characters Windows rejects and trims trailing dots/spaces', () => {
    expect(sanitizeStem('kick: hard?')).toBe('kick_ hard_')
    expect(sanitizeStem('snare. ')).toBe('snare')
  })

  it('keeps ordinary names untouched', () => {
    expect(sanitizeStem('door_slam_03')).toBe('door_slam_03')
  })
})
