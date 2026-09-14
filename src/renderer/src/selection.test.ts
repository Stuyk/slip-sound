import { describe, expect, it, vi } from 'vitest'
import type { SearchParams, SoundRow } from '../../preload/index'
import { fetchAllMatchingSounds, type SoundSearchApi } from './selection'

function sound(id: number): SoundRow {
  return {
    id,
    path: `/library/sound-${id}.wav`,
    filename: `sound-${id}.wav`,
    duration: id,
    channels: 2,
    sample_rate: 48000,
    filesize: id * 100,
    category: 'Foley',
    subcategory: null,
    confidence: 1,
    matched_terms: [],
    favorite: false,
    category_manual: false
  }
}

describe('fetchAllMatchingSounds', () => {
  it('requests every filtered row rather than only the first infinite-scroll page', async () => {
    const params: SearchParams = {
      query: 'footstep',
      category: 'Foley',
      channels: 2,
      favoriteOnly: true,
      sortBy: 'filename',
      sortDir: 'asc'
    }
    const rows = Array.from({ length: 235 }, (_, index) => sound(index + 1))
    const api: SoundSearchApi = {
      count: vi.fn().mockResolvedValue(rows.length),
      search: vi.fn().mockResolvedValue(rows)
    }

    const selection = await fetchAllMatchingSounds(api, params)

    expect(api.count).toHaveBeenCalledWith(params)
    expect(api.search).toHaveBeenCalledWith({ ...params, limit: 235, offset: 0 })
    expect(selection.size).toBe(235)
    expect(selection.get('/library/sound-235.wav')).toEqual(rows[234])
  })

  it('does not issue a search when no sounds match the filters', async () => {
    const api: SoundSearchApi = {
      count: vi.fn().mockResolvedValue(0),
      search: vi.fn()
    }

    const selection = await fetchAllMatchingSounds(api, { query: 'missing' })

    expect(selection.size).toBe(0)
    expect(api.search).not.toHaveBeenCalled()
  })

  it('keys the selection by path so it remains stable as visible row indexes change', async () => {
    const duplicatePathRows = [sound(1), { ...sound(2), path: sound(1).path }]
    const api: SoundSearchApi = {
      count: vi.fn().mockResolvedValue(duplicatePathRows.length),
      search: vi.fn().mockResolvedValue(duplicatePathRows)
    }

    const selection = await fetchAllMatchingSounds(api, { query: '' })

    expect(selection.size).toBe(1)
    expect(selection.get('/library/sound-1.wav')?.id).toBe(2)
  })
})
