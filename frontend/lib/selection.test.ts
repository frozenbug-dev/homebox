import { describe, expect, it } from "vitest";
import { emptySelection, prune, selectAll, selectRange, toggle } from "./selection";

const keys = ["a", "b", "c", "d", "e"];
const sel = (s: { selected: ReadonlySet<string> }) => [...s.selected].sort();

describe("selection", () => {
  it("toggles one key and moves the anchor", () => {
    let s = toggle(emptySelection(), "b");
    expect(sel(s)).toEqual(["b"]);
    expect(s.anchor).toBe("b");
    s = toggle(s, "d");
    expect(sel(s)).toEqual(["b", "d"]);
    s = toggle(s, "b");
    expect(sel(s)).toEqual(["d"]);
    expect(s.anchor).toBe("b");
  });

  it("selects a range from the anchor, in either direction", () => {
    const s = toggle(emptySelection(), "b");
    expect(sel(selectRange(s, keys, "d"))).toEqual(["b", "c", "d"]);
    expect(sel(selectRange(toggle(emptySelection(), "d"), keys, "a"))).toEqual(["a", "b", "c", "d"]);
  });

  it("starts a range at the target when there is no anchor", () => {
    expect(sel(selectRange(emptySelection(), keys, "c"))).toEqual(["c"]);
  });

  it("adds a range on top of an earlier selection", () => {
    let s = toggle(emptySelection(), "a");
    s = toggle(s, "c");
    s = selectRange(s, keys, "e");
    expect(sel(s)).toEqual(["a", "c", "d", "e"]);
  });

  it("shrinks the range when the far end moves back towards the anchor", () => {
    let s = toggle(emptySelection(), "b");
    s = selectRange(s, keys, "e");
    expect(sel(s)).toEqual(["b", "c", "d", "e"]);
    s = selectRange(s, keys, "c");
    expect(sel(s)).toEqual(["b", "c"]);
    s = selectRange(s, keys, "a");
    expect(sel(s)).toEqual(["a", "b"]);
  });

  it("ignores keys that are not in the list", () => {
    const s = toggle(emptySelection(), "a");
    expect(selectRange(s, keys, "zzz")).toBe(s);
  });

  it("selects everything", () => {
    expect(sel(selectAll(keys))).toEqual(keys);
  });

  it("prunes keys that left the list", () => {
    let s = toggle(emptySelection(), "a");
    s = toggle(s, "e");
    const pruned = prune(s, ["a", "b"]);
    expect(sel(pruned)).toEqual(["a"]);
    expect(pruned.anchor).toBeNull();
    expect(prune(pruned, ["a", "b"])).toBe(pruned);
  });
});
