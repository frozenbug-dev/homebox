import { describe, expect, test } from "vitest";
import { hasCommandTokens, parseCommand } from "./command-parser";

describe("parseCommand", () => {
  test("plain text is just a name", () => {
    expect(parseCommand("  cordless drill ")).toEqual({ name: "cordless drill", tags: [] });
  });

  test("parses place, tags, quantity and price", () => {
    expect(parseCommand("cordless drill @garage #tools #power ×2 $89.99")).toEqual({
      name: "cordless drill",
      place: "garage",
      tags: ["tools", "power"],
      quantity: 2,
      price: 89.99,
    });
  });

  test("token values may contain spaces", () => {
    expect(parseCommand("motion sensor @living room #home assistant")).toEqual({
      name: "motion sensor",
      place: "living room",
      tags: ["home assistant"],
    });
  });

  test("accepts x and * for quantity, and comma decimals for price", () => {
    expect(parseCommand("batteries x12 $4,50")).toMatchObject({ name: "batteries", quantity: 12, price: 4.5 });
    expect(parseCommand("batteries *3")).toMatchObject({ quantity: 3 });
  });

  test("@ and # inside words stay part of the name", () => {
    expect(parseCommand("C# book for me@home")).toEqual({ name: "C# book for me@home", tags: [] });
    expect(parseCommand("xbox controller")).toEqual({ name: "xbox controller", tags: [] });
  });

  test("ignores empty and invalid token values", () => {
    expect(parseCommand("drill @ # ×0 $abc")).toEqual({ name: "drill", tags: [] });
  });

  test("dedupes tags and keeps the last place", () => {
    expect(parseCommand("drill #tools #tools @garage @shed")).toEqual({
      name: "drill",
      place: "shed",
      tags: ["tools"],
    });
  });
});

describe("hasCommandTokens", () => {
  test("detects tokens", () => {
    expect(hasCommandTokens("drill @garage")).toBe(true);
    expect(hasCommandTokens("drill")).toBe(false);
    expect(hasCommandTokens("me@home")).toBe(false);
  });
});
