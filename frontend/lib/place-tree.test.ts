import { describe, expect, it } from "vitest";
import { ancestors, canNest, filterTree, indexPlaces, subtreeIds } from "./place-tree";
import type { TreeItem } from "~/lib/api/types/data-contracts";

const node = (id: string, children: TreeItem[] = []): TreeItem => ({ id, name: id, type: "location", children });

// house > garage > shelf, house > kitchen; office
const tree = [node("house", [node("garage", [node("shelf")]), node("kitchen")]), node("office")];
const index = indexPlaces(tree);

describe("place tree", () => {
  it("lists a place and everything below it", () => {
    expect(subtreeIds(index, "house")).toEqual(["house", "garage", "shelf", "kitchen"]);
    expect(subtreeIds(index, "office")).toEqual(["office"]);
    expect(subtreeIds(index, "missing")).toEqual([]);
  });

  it("finds ancestors from the top down", () => {
    expect(ancestors(index, "shelf").map(n => n.id)).toEqual(["house", "garage"]);
    expect(ancestors(index, "office")).toEqual([]);
  });

  it("refuses to nest a place into itself, its descendants or its current parent", () => {
    expect(canNest(index, "garage", "garage")).toBe(false);
    expect(canNest(index, "house", "shelf")).toBe(false);
    expect(canNest(index, "garage", "house")).toBe(false);
    expect(canNest(index, "garage", "office")).toBe(true);
    expect(canNest(index, "shelf", "kitchen")).toBe(true);
  });

  it("keeps matches and their ancestors when filtering", () => {
    const result = filterTree(tree, "SHE");
    expect(result.map(n => n.id)).toEqual(["house"]);
    expect(result[0]!.children.map(n => n.id)).toEqual(["garage"]);
    expect(result[0]!.children[0]!.children.map(n => n.id)).toEqual(["shelf"]);
  });

  it("drops places that fail the keep test", () => {
    const result = filterTree(tree, "", n => n.id !== "kitchen");
    expect(result[0]!.children.map(n => n.id)).toEqual(["garage"]);
    expect(result.map(n => n.id)).toEqual(["house", "office"]);
  });
});
