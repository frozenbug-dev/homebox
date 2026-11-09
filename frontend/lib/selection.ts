/**
 * Multi-selection for lists, the way desktop apps (and Linear) do it:
 *
 * - `toggle` (⌘/Ctrl-click, X, the checkbox) flips one row and makes it the anchor.
 * - `selectRange` (⇧-click, ⇧↑/↓) selects everything between the anchor and a row,
 *   on top of what was selected before the range started. Moving the far end back
 *   towards the anchor shrinks the range again.
 *
 * All functions are pure and return a new state.
 */
export type SelectionState = {
  selected: ReadonlySet<string>;
  /** Where the next range starts. */
  anchor: string | null;
  /** What was selected before the current range; a range is added to this. */
  base: ReadonlySet<string>;
};

export const emptySelection = (): SelectionState => ({ selected: new Set(), anchor: null, base: new Set() });

export function toggle(state: SelectionState, key: string): SelectionState {
  const selected = new Set(state.selected);
  if (selected.has(key)) selected.delete(key);
  else selected.add(key);
  return { selected, anchor: key, base: new Set(selected) };
}

/** Select from the anchor to `to` (inclusive), keeping what was selected before. */
export function selectRange(state: SelectionState, keys: readonly string[], to: string): SelectionState {
  const end = keys.indexOf(to);
  if (end < 0) return state;
  const anchor = state.anchor !== null && keys.includes(state.anchor) ? state.anchor : to;
  const start = keys.indexOf(anchor);
  const [from, until] = start <= end ? [start, end] : [end, start];
  const selected = new Set(state.base);
  for (let i = from; i <= until; i++) selected.add(keys[i]!);
  return { selected, anchor, base: state.base };
}

export function selectAll(keys: readonly string[]): SelectionState {
  const selected = new Set(keys);
  return { selected, anchor: keys[0] ?? null, base: new Set(selected) };
}

/** Drop keys that are no longer in the list (after a refetch, delete or filter change). */
export function prune(state: SelectionState, keys: readonly string[]): SelectionState {
  const present = new Set(keys);
  const keep = (set: ReadonlySet<string>) => new Set([...set].filter(k => present.has(k)));
  const selected = keep(state.selected);
  if (selected.size === state.selected.size && (state.anchor === null || present.has(state.anchor))) return state;
  return { selected, anchor: state.anchor && present.has(state.anchor) ? state.anchor : null, base: keep(state.base) };
}
