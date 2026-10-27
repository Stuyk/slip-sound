import { describe, expect, it } from 'vitest'
import { buildFolderTree, filterFolderTree, folderRange } from './folders'

const files = [
  '/lib/Foley/Cloth/rustle.wav',
  '/lib/Foley/Cloth/zip.wav',
  '/lib/Foley/step.wav',
  '/lib/Foley2/odd.wav',
  '/lib/Ambiences/rain 10.wav',
  '/lib/Ambiences/City 2/traffic.wav',
  '/lib/Ambiences/City 10/horns.wav',
  '/lib/top.wav',
  '/elsewhere/x.wav'
]

describe('folderRange', () => {
  const inRange = (p: string, [lo, hi]: [string, string]): boolean => p >= lo && p < hi

  it('covers the folder and its subfolders but not siblings with the same prefix', () => {
    const r = folderRange('/lib/Foley')
    expect(inRange('/lib/Foley/step.wav', r)).toBe(true)
    expect(inRange('/lib/Foley/Cloth/zip.wav', r)).toBe(true)
    expect(inRange('/lib/Foley2/odd.wav', r)).toBe(false)
    expect(inRange('/lib/Foley', r)).toBe(false)
  })

  it('ignores a trailing separator and handles Windows paths', () => {
    expect(folderRange('/lib/Foley/')).toEqual(folderRange('/lib/Foley'))
    const r = folderRange('C:\\lib\\Foley')
    expect(inRange('C:\\lib\\Foley\\a.wav', r)).toBe(true)
    expect(inRange('C:\\lib\\Foley2\\a.wav', r)).toBe(false)
  })
})

describe('buildFolderTree', () => {
  const tree = buildFolderTree(files, '/lib/')

  it('counts sounds recursively and skips files outside the root', () => {
    expect(tree.path).toBe('/lib')
    expect(tree.count).toBe(8)
    const foley = tree.children.find((c) => c.name === 'Foley')!
    expect(foley.count).toBe(3)
    expect(foley.children.map((c) => [c.name, c.count])).toEqual([['Cloth', 2]])
    expect(foley.children[0].path).toBe('/lib/Foley/Cloth')
  })

  it('sorts folders naturally', () => {
    expect(tree.children.map((c) => c.name)).toEqual(['Ambiences', 'Foley', 'Foley2'])
    const amb = tree.children[0]
    expect(amb.children.map((c) => c.name)).toEqual(['City 2', 'City 10'])
  })

  it('works with Windows separators', () => {
    const t = buildFolderTree(['C:\\lib\\A\\b.wav', 'C:\\lib\\c.wav'], 'C:\\lib')
    expect(t.count).toBe(2)
    expect(t.children[0]).toMatchObject({ name: 'A', path: 'C:\\lib\\A', count: 1 })
  })
})

describe('filterFolderTree', () => {
  const tree = buildFolderTree(files, '/lib')

  it('shows matches and the folders above them, expanding the path', () => {
    const { visible, expand } = filterFolderTree(tree, 'city')
    expect([...visible].sort()).toEqual([
      '/lib',
      '/lib/Ambiences',
      '/lib/Ambiences/City 10',
      '/lib/Ambiences/City 2'
    ])
    expect(expand.has('/lib/Ambiences')).toBe(true)
  })

  it('keeps the contents of a matching folder reachable', () => {
    const { visible, expand } = filterFolderTree(tree, 'foley')
    expect(visible.has('/lib/Foley/Cloth')).toBe(true)
    expect(expand.has('/lib/Foley')).toBe(false)
  })

  it('returns nothing for an empty query', () => {
    expect(filterFolderTree(tree, '  ').visible.size).toBe(0)
  })
})
