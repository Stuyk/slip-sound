import type { SearchParams, SoundRow } from '../../preload/index'

export interface SoundSearchApi {
  count: (params: SearchParams) => Promise<number>
  search: (params: SearchParams) => Promise<SoundRow[]>
}

export async function fetchAllMatchingSounds(
  api: SoundSearchApi,
  params: SearchParams
): Promise<Map<string, SoundRow>> {
  const total = await api.count(params)
  if (total === 0) return new Map()

  const rows = await api.search({ ...params, limit: total, offset: 0 })
  return new Map(rows.map((row) => [row.path, row]))
}
