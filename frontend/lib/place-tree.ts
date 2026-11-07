import type { TreeItem } from "~/lib/api/types/data-contracts";

/** Lookups over the places tree as the /entities/tree endpoint returns it. */
export type PlaceIndex = {
  byId: Map<string, TreeItem>;
  parentOf: Map<string, string | null>;
};

export function indexPlaces(tree: TreeItem[]): PlaceIndex {
  const byId = new Map<string, TreeItem>();
  const parentOf = new Map<string, string | null>();
  const walk = (nodes: TreeItem[], parent: string | null) => {
    for (const node of nodes) {
      byId.set(node.id, node);
      parentOf.set(node.id, parent);
      walk(node.children ?? [], node.id);
    }
  };
  walk(tree, null);
  return { byId, parentOf };
}

/** The place and every place below it. */
export function subtreeIds(index: PlaceIndex, id: string): string[] {
  const node = index.byId.get(id);
  if (!node) return [];
  const out: string[] = [];
  const walk = (n: TreeItem) => {
    out.push(n.id);
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out;
}

/** Ancestors from the top down, not including the place itself. */
export function ancestors(index: PlaceIndex, id: string): TreeItem[] {
  const out: TreeItem[] = [];
  let current = index.parentOf.get(id) ?? null;
  while (current) {
    const node = index.byId.get(current);
    if (!node) break;
    out.unshift(node);
    current = index.parentOf.get(current) ?? null;
  }
  return out;
}

/** A place can move into any place that isn't itself, below itself, or already its parent. */
export function canNest(index: PlaceIndex, placeId: string, targetId: string): boolean {
  if (placeId === targetId || index.parentOf.get(placeId) === targetId) return false;
  return !subtreeIds(index, placeId).includes(targetId);
}

/**
 * Keeps the places whose name matches `query` (and their ancestors, so they
 * stay reachable) and, with `keep`, only places that pass that test.
 */
export function filterTree(nodes: TreeItem[], query: string, keep?: (node: TreeItem) => boolean): TreeItem[] {
  const q = query.trim().toLowerCase();
  const out: TreeItem[] = [];
  for (const node of nodes) {
    if (keep && !keep(node)) continue;
    const children = filterTree(node.children ?? [], query, keep);
    if (!q || node.name.toLowerCase().includes(q) || children.length > 0) {
      out.push({ ...node, children });
    }
  }
  return out;
}
