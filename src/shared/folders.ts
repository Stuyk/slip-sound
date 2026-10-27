// Folder hierarchy of a library, built from the indexed file paths.

export interface FolderNode {
  name: string
  // Absolute folder path, as stored in the index (native separators).
  path: string
  // Sounds in this folder and everything under it.
  count: number
  children: FolderNode[]
}

export const separatorOf = (p: string): '/' | '\\' =>
  p.includes('\\') && !p.includes('/') ? '\\' : '/'

const trimSep = (p: string, sep: string): string =>
  p.length > 1 && p.endsWith(sep) ? p.slice(0, -1) : p

// Half-open string range [lo, hi) that holds every path inside `folder`.
// The character after the separator in code-point order closes the range, so a
// plain indexed `path >= lo AND path < hi` matches the folder and its subfolders
// but not a sibling like "Foley2" when filtering "Foley".
export function folderRange(folder: string, sep = separatorOf(folder)): [string, string] {
  const base = trimSep(folder, sep)
  return [base + sep, base + String.fromCharCode(sep.charCodeAt(0) + 1)]
}

const byName = (a: FolderNode, b: FolderNode): number =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

// Builds the tree under `root` from file paths. Files outside the root are ignored.
export function buildFolderTree(filePaths: Iterable<string>, root: string): FolderNode {
  const sep = separatorOf(root)
  const base = trimSep(root, sep)
  const rootNode: FolderNode = {
    name: base.split(sep).pop() || base,
    path: base,
    count: 0,
    children: []
  }
  const index = new Map<string, FolderNode>()
  const childOf = (parent: FolderNode, name: string): FolderNode => {
    const path = parent.path + sep + name
    let node = index.get(path)
    if (!node) {
      node = { name, path, count: 0, children: [] }
      index.set(path, node)
      parent.children.push(node)
    }
    return node
  }
  const prefix = base + sep
  for (const file of filePaths) {
    if (!file.startsWith(prefix)) continue
    rootNode.count++
    const parts = file.slice(prefix.length).split(sep)
    let node = rootNode
    // The last part is the file name.
    for (let i = 0; i < parts.length - 1; i++) {
      if (!parts[i]) continue
      node = childOf(node, parts[i])
      node.count++
    }
  }
  const sortDeep = (n: FolderNode): void => {
    n.children.sort(byName)
    n.children.forEach(sortDeep)
  }
  sortDeep(rootNode)
  return rootNode
}

// Folders whose name matches `query`, plus their ancestors so they stay reachable
// and their descendants so a match can still be opened. Returns the set of paths
// to show and the set to expand (ancestors of matches).
export function filterFolderTree(
  root: FolderNode,
  query: string
): { visible: Set<string>; expand: Set<string> } {
  const q = query.trim().toLowerCase()
  const visible = new Set<string>()
  const expand = new Set<string>()
  const addAll = (n: FolderNode): void => {
    visible.add(n.path)
    n.children.forEach(addAll)
  }
  const walk = (n: FolderNode, ancestors: FolderNode[]): boolean => {
    let any = false
    for (const c of n.children) if (walk(c, [...ancestors, n])) any = true
    const hit = n !== root && n.name.toLowerCase().includes(q)
    if (hit || any) {
      visible.add(n.path)
      if (any) expand.add(n.path)
      for (const a of ancestors) visible.add(a.path)
    }
    if (hit) addAll(n)
    return hit || any
  }
  if (q) walk(root, [])
  return { visible, expand }
}
